import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { DEFAULT_REDIRECTS } from '@/lib/redirects'
import { isCrawler } from '@/lib/crawler-detect'

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

/**
 * يقرأ مقالاً من مجلد articles.
 * إذا لم يوجد الملف، نُرجع 404 صريحًا مع log واضح (لا fallback صامت إلى 1997.html).
 * الـ fallback إلى 1997.html يحدث فقط في طبقة أعلى، عند فقدان كل القواعد.
 */
async function serveArticle(articleId: string): Promise<NextResponse> {
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
    console.warn(`[serveArticle] MISSING articles/${articleId}.html`)
    return new NextResponse(`Article "${articleId}" not found`, {
      status: 404,
      headers: corsHeaders(),
    })
  }
}

async function servePdf(): Promise<NextResponse> {
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
    return new NextResponse('PDF not found', { status: 404, headers: corsHeaders() })
  }
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
  const bot = isCrawler(ua)

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
      // مثلاً rule.articleId='4560' → articles/4560.html
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
  if (articleId) {
    try {
      const articlePath = path.join(ARTICLES_DIR, `${articleId}.html`)
      const fileExists = await fs.stat(articlePath).then((s) => s.isFile()).catch(() => false)
      if (fileExists) {
        return serveArticle(articleId)
      }
    } catch {
      // تجاهل ومتابعة
    }
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
