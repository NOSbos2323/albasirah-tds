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
  const params = request.nextUrl.searchParams
  const ua = request.headers.get('user-agent') || ''
  const ip = getClientIp(request.headers)

  const serveArticle = async (articleId: string) => {
    try {
      const articlePath = path.join(ARTICLES_DIR, `${articleId}.html`)
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

  // 1. البحث في جميع المعاملات في الرابط للتحقق من وجود قاعدة توجيه نشطة متطابقة
  let activeRuleToUse = null
  let matchedParamName = ''
  let matchedArticleId = ''

  for (const [key, value] of params.entries()) {
    const trimmedVal = value?.trim()
    if (!trimmedVal) continue

    try {
      const rule = await db.redirectRule.findUnique({
        where: {
          parameterName_articleId: {
            parameterName: key.trim(),
            articleId: trimmedVal,
          },
        },
      })

      if (rule && rule.active && rule.targetUrl) {
        activeRuleToUse = rule
        matchedParamName = key.trim()
        matchedArticleId = trimmedVal
        break // بمجرد العثور على قاعدة نشطة، نستخدمها
      }
    } catch (e) {
      // تجاهل الخطأ لمتابعة الفحص
    }
  }

  // 2. إذا وجدت قاعدة نشطة ولم يكن الزائر زاحف محركات بحث (Crawler)، ننفذ التوجيه
  if (activeRuleToUse && !isCrawler(ua)) {
    const known = await db.knownIp.upsert({
      where: { ip },
      update: {},
      create: { ip },
    })

    const isNew = Date.now() - known.createdAt.getTime() < 2000

    if (isNew) {
      await db.$transaction([
        db.redirectRule.update({
          where: { id: activeRuleToUse.id },
          data: { clicks: { increment: 1 } },
        }),
        db.clickLog.create({
          data: { 
            articleId: matchedArticleId, 
            targetUrl: activeRuleToUse.targetUrl, 
            ip, 
            ua: ua.slice(0, 500) 
          },
        }),
      ])
    }

    return NextResponse.json(
      { redirectUrl: activeRuleToUse.targetUrl },
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          ...corsHeaders(),
        },
      }
    )
  }

  // 3. إذا لم تكن هناك قاعدة نشطة، أو كان الزائر عبارة عن زاحف (Crawler):
  // نقوم بالبحث في المعاملات لعرض المقال الموافق لأول قيمة نجد لها ملف HTML حقيقي
  for (const [key, value] of params.entries()) {
    const trimmedVal = value?.trim()
    if (!trimmedVal) continue

    try {
      const articlePath = path.join(ARTICLES_DIR, `${trimmedVal}.html`)
      const fileExists = await fs.stat(articlePath).then(stat => stat.isFile()).catch(() => false)
      if (fileExists) {
        return serveArticle(trimmedVal)
      }
    } catch {
      // تجاهل ومتابعة الفحص
    }
  }

  // 4. استرجاع افتراضي إذا لم يتم العثور على أي مقال
  const fallbackId = params.get('ids')?.trim() || params.get('io0')?.trim() || ''
  if (fallbackId) {
    return serveArticle(fallbackId)
  }

  return new NextResponse('Invalid or missing parameters', { 
    status: 400,
    headers: corsHeaders() 
  })
}

export const POST = GET

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(),
  })
}
