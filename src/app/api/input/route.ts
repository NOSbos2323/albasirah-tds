import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { DEFAULT_REDIRECTS } from '@/lib/redirects'
import { isCrawler, isCrawlerDetailed } from '@/lib/crawler-detect'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * مسارات البحث عن المقالات — نحاول عدة مواقع لأن process.cwd() يختلف بين
 * التطوير المحلي (جذر المشروع)، Vercel serverless (حيث public/ متاح فقط)،
 * و standalone output (.next/standalone/public/articles).
 */
const ARTICLE_SEARCH_DIRS = [
  path.join(process.cwd(), 'public', 'articles'),           // Vercel + dev (المسار الأساسي الجديد)
  path.join(process.cwd(), 'articles'),                      // المسار القديم (للـ standalone المحلي)
  path.join(process.cwd(), 'public', 'articles'),            // مكرر عمدًا للأولوية
  path.join(process.cwd(), '.next', 'standalone', 'public', 'articles'),  // standalone build
]

// دالة مساعدة لإضافة ترويسات الـ CORS لأي استجابة
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Range',
    'Cache-Control': 'no-store',
  }
}

/**
 * يبحث عن مقال في كل المسارات المعروفة ويرجع محتواه.
 * إذا لم يوجد في أي مسار، نُرجع null (والطبقة العليا تقرر ماذا تفعل).
 */
async function readArticleHtml(articleId: string): Promise<string | null> {
  // منع path traversal: articleId يجب أن يكون أرقام/حروف فقط
  if (!/^[a-zA-Z0-9_-]+$/.test(articleId)) {
    return null
  }
  const filename = `${articleId}.html`
  for (const dir of ARTICLE_SEARCH_DIRS) {
    try {
      const filePath = path.join(dir, filename)
      const html = await fs.readFile(filePath, 'utf8')
      return html
    } catch {
      // جرّب المسار التالي
    }
  }
  return null
}

async function checkArticleExists(articleId: string): Promise<boolean> {
  if (!/^[a-zA-Z0-9_-]+$/.test(articleId)) return false
  const filename = `${articleId}.html`
  for (const dir of ARTICLE_SEARCH_DIRS) {
    try {
      const filePath = path.join(dir, filename)
      const stat = await fs.stat(filePath)
      if (stat.isFile()) return true
    } catch {
      // جرّب المسار التالي
    }
  }
  return false
}

async function serveArticle(articleId: string): Promise<NextResponse> {
  const html = await readArticleHtml(articleId)
  if (html) {
    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        ...corsHeaders(),
      },
    })
  }
  console.warn(`[serveArticle] MISSING article id=${articleId} (searched ${ARTICLE_SEARCH_DIRS.length} dirs)`)
  return new NextResponse(`Article "${articleId}" not found`, {
    status: 404,
    headers: corsHeaders(),
  })
}

async function servePdf(): Promise<NextResponse> {
  const searchPaths = [
    path.join(process.cwd(), 'public', 'pdfviewer', 'api.pdf'),
    path.join(process.cwd(), '.next', 'standalone', 'public', 'pdfviewer', 'api.pdf'),
  ]
  for (const p of searchPaths) {
    try {
      const fileBuffer = await fs.readFile(p)
      return new NextResponse(fileBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'inline',
          ...corsHeaders(),
        },
      })
    } catch {
      // جرّب المسار التالي
    }
  }
  return new NextResponse('PDF not found', { status: 404, headers: corsHeaders() })
}

/**
 * يرجع أول قيمة معامل ذات معنى (يتجاهل _from_viewer والقيم الفارغة).
 */
function pickArticleIdFromParams(params: URLSearchParams): string | null {
  // الأولوية: المعاملات المعروفة أولاً
  const known = ['ids', 'io0', 'id', 'articleId']
  for (const key of known) {
    const v = params.get(key)?.trim()
    if (v) return v
  }
  // أي معامل آخر
  for (const [key, value] of params.entries()) {
    const v = value?.trim()
    if (!v || key === '_from_viewer') continue
    return v
  }
  return null
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const ua = request.headers.get('user-agent') || ''
  // نمرر الـ headers الكاملة لـ isCrawler ليتمكن من قراءة cf-bot و cf-bm
  const detection = isCrawlerDetailed(ua, request.headers)
  const bot = detection.isCrawler
  if (bot) {
    console.info(`[input] bot detected via ${detection.source} (${detection.detail})`)
  }

  const articleId = pickArticleIdFromParams(params)

  // 0. عارض PDF بدون معرف مقال → PDF مباشرة
  if (params.get('_from_viewer') === 'true' && !articleId) {
    return servePdf()
  }

  // 1. البحث عن قاعدة توجيه ثابتة في DEFAULT_REDIRECTS
  if (articleId) {
    const rule = DEFAULT_REDIRECTS.find((r) => r.articleId === articleId)

    if (rule) {
      // ─── للزاحف (Bot): خدم المقال المخصص له (articleId) ───
      if (bot) {
        return serveArticle(rule.articleId)
      }

      // ─── للإنسان (Human): ───
      //   - إذا targetUrl يشير لمقال داخلي (articles/X.html أو X.html):
      //       خدم ذلك المقال. مثلاً 'articles/1997.html' → articles/1997.html
      //   - وإلا: أرجع JSON {redirectUrl} ليتولى good.js التوجيه الخارجي
      const target = rule.targetUrl
      if (target.startsWith('articles/') || target.endsWith('.html')) {
        const targetArticleId = target.replace(/^articles\//, '').replace(/\.html$/, '')
        return serveArticle(targetArticleId)
      }
      return NextResponse.json(
        { redirectUrl: target },
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            ...corsHeaders(),
          },
        }
      )
    }
  }

  // 2. لا قاعدة توجيه — فحص وجود ملف المقال
  //    - للبوت: خدم المقال إن وُجد، وإلا 404 صريح
  //    - للإنسان: خدم المقال إن وُجد (سلوك الـ rewrite العادي)
  if (articleId && (await checkArticleExists(articleId))) {
    return serveArticle(articleId)
  }

  // 3. عارض PDF (ولكن مع معرف مقال غير مطابق لأي قاعدة وغير موجود كملف)
  //    نُرجع PDF لتفادي كسر عارض الـ viewer
  if (params.get('_from_viewer') === 'true') {
    return servePdf()
  }

  // 4. fallback أخير: إذا كان فيه articleId، حاول خدم 1997.html كغطاء SEO
  if (articleId) {
    console.info(`[input] fallback to 1997.html for unknown id=${articleId} bot=${bot}`)
    return serveArticle('1997')
  }

  // 5. لا معرف على الإطلاق → 400
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
