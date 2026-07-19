import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface Params {
  params: Promise<{ id: string }>
}

/** Update a redirect rule. Body: { targetUrl?, note?, active? } */
export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params
  let body: any = {}
  try {
    body = await request.json()
  } catch {
    // allow empty body — fall through
  }

  const data: any = {}
  if (typeof body.targetUrl === 'string') data.targetUrl = body.targetUrl.trim()
  if (typeof body.note === 'string') data.note = body.note.trim() || null
  if (typeof body.active === 'boolean') data.active = body.active
  if (typeof body.clicks === 'number') data.clicks = Math.max(0, body.clicks)

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const rule = await db.redirectRule.update({
    where: { id },
    data,
  })
  return NextResponse.json({ rule })
}

/** Delete a redirect rule. */
export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params
  await db.redirectRule.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
