/**
 * One-off import: copy the legacy flat-file logs (data/clicks.log, data/ips.txt)
 * from the uploaded repo into the new Prisma database so the dashboard has
 * historical data on day one.
 */
import path from 'path'
import fs from 'fs'
import { db } from '../src/lib/db'
import { DEFAULT_REDIRECTS } from '../src/lib/redirects'

const LEGACY_DIR = path.join(__dirname, '..', 'upload', 'extracted', 'albasirah-migration-v2-main', 'data')

async function main() {
  // 1. Import clicks.log  -> aggregate into RedirectRule.clicks + ClickLog rows
  const clicksFile = path.join(LEGACY_DIR, 'clicks.log')
  if (fs.existsSync(clicksFile)) {
    const raw = fs.readFileSync(clicksFile, 'utf8')
    const lines = raw.split('\n').filter((l: string) => l.trim())
    let imported = 0
    for (const line of lines) {
      const parts = line.split(',').map((s: string) => s.trim())
      if (parts.length < 3) continue
      const articleId = parts[0]
      const targetUrl = parts[1]
      const clicks = parseInt(parts[2], 10)
      if (!articleId || !targetUrl || isNaN(clicks)) continue

      // Ensure a redirect rule exists (some legacy ids aren't in DEFAULT_REDIRECTS).
      await db.redirectRule.upsert({
        where: { articleId },
        update: { clicks: { increment: clicks } },
        create: { articleId, targetUrl, clicks, active: true, note: 'imported from legacy log' },
      })

      // Append a single summary ClickLog row per legacy entry so the recent
      // activity feed has something to show. (We can't recover per-click IPs.)
      await db.clickLog.create({
        data: {
          articleId,
          targetUrl,
          ip: 'legacy',
          ua: 'imported from server log',
          createdAt: new Date(),
        },
      })
      imported++
    }
    console.log(`imported ${imported} legacy click entries`)
  }

  // 2. Import ips.txt -> KnownIp
  const ipsFile = path.join(LEGACY_DIR, 'ips.txt')
  if (fs.existsSync(ipsFile)) {
    const raw = fs.readFileSync(ipsFile, 'utf8')
    const ips = raw.split('\n').map((s: string) => s.trim()).filter(Boolean)
    let ipCount = 0
    for (const ip of ips) {
      await db.knownIp.upsert({
        where: { ip },
        update: {},
        create: { ip },
      })
      ipCount++
    }
    console.log(`imported ${ipCount} legacy IPs`)
  }

  // summary
  const rules = await db.redirectRule.count()
  const logs = await db.clickLog.count()
  const ips = await db.knownIp.count()
  console.log({ rules, logs, ips })
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => db.$disconnect())
