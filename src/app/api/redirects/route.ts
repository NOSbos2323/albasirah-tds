import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** List all redirect rules. */
export async function GET() {
  const rules = await db.redirectRule.findMany({
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json({ rules })
}

/** Create a new redirect rule. Body: { articleId, targetUrl, note?, active? } */
export async function POST(request: NextRequest) {
  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const articleId = String(body?.articleId || '').trim()
  const targetUrl = String(body?.targetUrl || '').trim()
  const note = body?.note ? String(body.note).trim() : null
  const active = body?.active !== false

  if (!articleId || !targetUrl) {
    return NextResponse.json(
      { error: 'articleId and targetUrl are required' },
      { status: 400 }
    )
  }

  try {
    const rule = await db.redirectRule.create({
      data: { articleId, targetUrl, note, active },
    })
    return NextResponse.json({ rule }, { status: 201 })
  } catch (e: any) {
    if (String(e?.code || '') === 'P2002') {
      return NextResponse.json(
        { error: `A rule for articleId "${articleId}" already exists` },
        { status: 409 }
      )
    }
    throw e
  }
}
