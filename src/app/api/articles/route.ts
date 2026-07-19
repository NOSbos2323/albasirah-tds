import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { db } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Lists every article HTML file in /articles, joined with its redirect
 * rule (if any) so the dashboard can show coverage at a glance.
 *
 * NOTE: articles live at project root (NOT under /public) so they cannot be
 * fetched directly — direct /articles/<id>.html hits fall through to the
 * catch-all rewrite and return the cover PDF, exactly like the original server.
 */
export async function GET() {
  const dir = path.join(process.cwd(), 'articles')
  let files: string[] = []
  try {
    files = await fs.readdir(dir)
  } catch {
    files = []
  }
  const articleIds = files
    .filter((f) => f.endsWith('.html'))
    .map((f) => f.replace(/\.html$/, ''))

  const rules = await db.redirectRule.findMany()
  const ruleByArticle = new Map(rules.map((r) => [r.articleId, r]))

  const articles = articleIds.map((id) => {
    const rule = ruleByArticle.get(id)
    return {
      id,
      hasRule: !!rule,
      rule: rule
        ? {
            targetUrl: rule.targetUrl,
            active: rule.active,
            clicks: rule.clicks,
          }
        : null,
    }
  })

  return NextResponse.json({ articles })
}
