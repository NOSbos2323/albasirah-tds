import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const articlesDir = path.join(process.cwd(), 'articles')
    const files = await fs.readdir(articlesDir)
    const articles = files
      .filter(file => file.endsWith('.html'))
      .map(file => file.replace('.html', ''))

    return NextResponse.json({ success: true, articles })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
