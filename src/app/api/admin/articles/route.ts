import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

/**
 * يبحث عن مجلد articles في عدة مواقع (متوافق مع Vercel + standalone + dev).
 */
async function findArticlesDir(): Promise<string | null> {
  const candidates = [
    path.join(process.cwd(), 'public', 'articles'),
    path.join(process.cwd(), 'articles'),
    path.join(process.cwd(), '.next', 'standalone', 'public', 'articles'),
  ]
  for (const dir of candidates) {
    try {
      const stat = await fs.stat(dir)
      if (stat.isDirectory()) return dir
    } catch {
      // جرّب المسار التالي
    }
  }
  return null
}

export async function GET() {
  try {
    const articlesDir = await findArticlesDir()
    if (!articlesDir) {
      return NextResponse.json({
        success: false,
        error: 'Articles directory not found in any expected location',
      }, { status: 500 })
    }
    const files = await fs.readdir(articlesDir)
    const articles = files
      .filter(file => file.endsWith('.html'))
      .map(file => file.replace('.html', ''))

    return NextResponse.json({ success: true, articles, dir: articlesDir })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
