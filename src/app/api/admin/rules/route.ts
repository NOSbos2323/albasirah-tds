import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const rules = await db.redirectRule.findMany({
      orderBy: { createdAt: 'desc' },
    })

    const logs = await db.clickLog.findMany({
      take: 50,
      orderBy: { createdAt: 'desc' },
    })

    const totalRules = rules.length
    const activeRules = rules.filter((r) => r.active).length
    const totalClicks = rules.reduce((sum, r) => sum + (r.clicks || 0), 0)

    // Calculate unique IPs from click logs or known IPs
    const uniqueIpsCount = await db.knownIp.count()

    return NextResponse.json({
      success: true,
      rules,
      logs,
      stats: {
        totalRules,
        activeRules,
        totalClicks,
        uniqueIps: uniqueIpsCount,
      },
    })
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { articleId, targetUrl, note, active, parameterName } = body

    const finalParamName = parameterName?.trim() || 'io0'

    if (!articleId || !targetUrl) {
      return NextResponse.json(
        { success: false, error: 'Article ID and Target URL are required' },
        { status: 400 }
      )
    }

    // Check if redirect rule already exists for this parameter and article ID combination
    const existing = await db.redirectRule.findUnique({
      where: {
        parameterName_articleId: {
          parameterName: finalParamName,
          articleId: articleId.trim(),
        },
      },
    })

    if (existing) {
      return NextResponse.json(
        { success: false, error: `A redirect rule already exists for Parameter: ${finalParamName} and Article ID: ${articleId}` },
        { status: 400 }
      )
    }

    const newRule = await db.redirectRule.create({
      data: {
        parameterName: finalParamName,
        articleId: articleId.trim(),
        targetUrl: targetUrl.trim(),
        note: note || '',
        active: active === true, // Default to inactive or false as per "لا يحدث اعادة توجيه الا اذا طلبت انا"
        clicks: 0,
      },
    })

    return NextResponse.json({ success: true, rule: newRule })
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, targetUrl, note, active, clicks, parameterName } = body

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Rule ID is required' },
        { status: 400 }
      )
    }

    const updated = await db.redirectRule.update({
      where: { id },
      data: {
        ...(parameterName !== undefined && { parameterName: parameterName.trim() }),
        ...(targetUrl !== undefined && { targetUrl: targetUrl.trim() }),
        ...(note !== undefined && { note }),
        ...(active !== undefined && { active }),
        ...(clicks !== undefined && { clicks }),
      },
    })

    return NextResponse.json({ success: true, rule: updated })
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Rule ID is required in query parameter' },
        { status: 400 }
      )
    }

    await db.redirectRule.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    )
  }
}
