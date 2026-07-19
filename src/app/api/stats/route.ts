import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Aggregated stats for the dashboard:
 *  - totals (rules, clicks, unique IPs, articles)
 *  - top redirect rules by clicks
 *  - recent click-log entries (activity feed)
 *  - recent unique IPs
 */
export async function GET() {
  const [totalRules, totalClicksAgg, totalIps, recentClicks, recentIps, topRules] =
    await Promise.all([
      db.redirectRule.count(),
      db.redirectRule.aggregate({ _sum: { clicks: true } }),
      db.knownIp.count(),
      db.clickLog.findMany({
        take: 20,
        orderBy: { createdAt: 'desc' },
      }),
      db.knownIp.findMany({
        take: 20,
        orderBy: { createdAt: 'desc' },
      }),
      db.redirectRule.findMany({
        orderBy: { clicks: 'desc' },
        take: 10,
      }),
    ])

  return NextResponse.json({
    totals: {
      rules: totalRules,
      clicks: totalClicksAgg._sum.clicks || 0,
      uniqueIps: totalIps,
      logEntries: recentClicks.length,
    },
    topRules,
    recentClicks,
    recentIps,
  })
}
