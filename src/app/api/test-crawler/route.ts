import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isCrawler, getClientIp } from '@/lib/crawler-detect'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Dry-run endpoint used by the dashboard's "TDS tester".
 * Query params:
 *   - ids    : the article id to test
 *   - ua     : optional override User-Agent (defaults to the caller's UA)
 * Returns the decision the live /api/input would make for this request,
 * WITHOUT writing any logs.
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams
  const ids = sp.get('ids')?.trim() || ''
  const uaOverride = sp.get('ua')
  const ua = uaOverride || request.headers.get('user-agent') || ''
  const ip = getClientIp(request.headers)

  if (!ids) {
    return NextResponse.json({ error: 'ids is required' }, { status: 400 })
  }

  const bot = isCrawler(ua)
  const rule = await db.redirectRule.findUnique({ where: { articleId: ids } })

  let decision: 'article' | 'redirect' | 'google_fallback' = 'article'
  let redirectUrl: string | null = null

  if (bot) {
    decision = 'article'
  } else if (rule && rule.active && rule.targetUrl) {
    decision = 'redirect'
    redirectUrl = rule.targetUrl
  } else {
    decision = 'article'
  }

  return NextResponse.json({
    ids,
    ua,
    ip,
    isCrawler: bot,
    rule: rule
      ? { targetUrl: rule.targetUrl, active: rule.active, clicks: rule.clicks }
      : null,
    decision,
    redirectUrl,
    note:
      decision === 'article'
        ? bot
          ? 'Crawler detected -> serve the HTML article (SEO cloaking).'
          : 'No active redirect rule -> serve the HTML article to this human.'
        : 'Human visitor -> return JSON { redirectUrl }; good.js does location.replace.',
  })
}
