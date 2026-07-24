import { db } from '../src/lib/db'
import { DEFAULT_REDIRECTS } from '../src/lib/redirects'

async function main() {
  for (const r of DEFAULT_REDIRECTS) {
    await db.redirectRule.upsert({
      where: { articleId: r.articleId },
      update: { targetUrl: r.targetUrl, note: r.note },
      create: { articleId: r.articleId, targetUrl: r.targetUrl, note: r.note, active: true },
    })
    console.log('seeded', r.articleId, '->', r.targetUrl)
  }
  const count = await db.redirectRule.count()
  console.log('total redirect rules:', count)
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => db.$disconnect())
