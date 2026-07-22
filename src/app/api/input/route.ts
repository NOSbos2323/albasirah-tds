import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { DEFAULT_REDIRECTS } from '@/lib/redirects'
import { isCrawler, getClientIp } from '@/lib/crawler-detect'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ARTICLES_DIR = path.join(process.cwd(), 'articles')

// دالة مساعدة لإضافة ترويسات الـ CORS لأي استجابة
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
      try {
        const fallbackPath = path.join(ARTICLES_DIR, '1997.html')
        const html = await fs.readFile(fallbackPath, 'utf8')
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
  }

  const servePdf = async () => {
    try {
      const pdfPath = path.join(process.cwd(), 'public', 'pdfviewer', 'api.pdf')
      const fileBuffer = await fs.readFile(pdfPath)
      return new NextResponse(fileBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'inline',
          ...corsHeaders(),
        },
      })
    } catch {
      return new NextResponse('PDF not found', { status: 404 })
    }
  }

  // 1. البحث في المعاملات عن مطابقة بقواعد التوجيه المسبقة (الثابتة بدون قاعدة بيانات)
  let foundTargetUrl: string | null = null
  let matchedArticleId: string | null = null

  for (const [key, value] of params.entries()) {
    const trimmedVal = value?.trim()
    if (!trimmedVal || key === '_from_viewer') continue

    const matchedRule = DEFAULT_REDIRECTS.find(
      (r) => r.articleId === trimmedVal
    )

    if (matchedRule) {
      foundTargetUrl = matchedRule.targetUrl
      matchedArticleId = matchedRule.articleId
      break
    }
  }

  // 2. إذا تم العثور على قاعدة توجيه مطابقة:
  if (foundTargetUrl && matchedArticleId) {
    // إذا كان مستخدم حقيقي وليس زاحف (Crawler):
    if (!isCrawler(ua)) {
      // إذا كانت القاعدة تشير لملف مقال داخلي (مثل articles/1997.html أو 1997.html)
      if (foundTargetUrl.startsWith('articles/') || foundTargetUrl.endsWith('.html')) {
        const targetArticleId = foundTargetUrl
          .replace(/^articles\//, '')
          .replace(/\.html$/, '')
        return serveArticle(targetArticleId)
      }

      return NextResponse.json(
        { redirectUrl: foundTargetUrl },
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            ...corsHeaders(),
          },
        }
      )
    }

    // إذا كان زاحف محركات البحث (Crawler): نعرض مقالة HTML المخصصة للبوت (مثلاً 4560.html)
    return serveArticle(matchedArticleId)
  }

  // 3. إذا لم تكن هناك قاعدة توجيه ثابتة، نبحث عن ملف مقال ينتهي بـ .html في مجلد articles
  for (const [key, value] of params.entries()) {
    const trimmedVal = value?.trim()
    if (!trimmedVal || key === '_from_viewer') continue

    try {
      const articlePath = path.join(ARTICLES_DIR, `${trimmedVal}.html`)
      const fileExists = await fs.stat(articlePath).then((stat) => stat.isFile()).catch(() => false)
      if (fileExists) {
        return serveArticle(trimmedVal)
      }
    } catch {
      // متابعة الفحص
    }
  }

  // 4. استرجاع افتراضي إذا كان الطلب قادماً من Viewer
  if (params.get('_from_viewer') === 'true') {
    return servePdf()
  }

  const fallbackId = params.get('ids')?.trim() || params.get('io0')?.trim() || params.get('id')?.trim() || params.get('articleId')?.trim() || ''
  if (fallbackId) {
    return serveArticle(fallbackId)
  }

  return new NextResponse('Invalid or missing parameters', {
    status: 400,
    headers: corsHeaders(),
  })
}

export const POST = GET

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(),
  })
}

