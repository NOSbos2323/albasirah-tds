import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { DEFAULT_REDIRECTS } from '@/lib/redirects'
import { isCrawler, isCrawlerDetailed } from '@/lib/crawler-detect'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ARTICLE_SEARCH_DIRS = [
  path.join(process.cwd(), 'public', 'articles'),
  path.join(process.cwd(), 'articles'),
  path.join(process.cwd(), '.next', 'standalone', 'public', 'articles'),
]

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Range',
    'Cache-Control': 'no-store',
  }
}

async function readArticleHtml(articleId: string): Promise<string | null> {
  if (!/^[a-zA-Z0-9_-]+$/.test(articleId)) return null
  const filename = `${articleId}.html`
  for (const dir of ARTICLE_SEARCH_DIRS) {
    try {
      const filePath = path.join(dir, filename)
      const html = await fs.readFile(filePath, 'utf8')
      return html
    } catch {}
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
    } catch {}
  }
  return false
}

async function serveArticle(articleId: string): Promise<NextResponse> {
  const html = await readArticleHtml(articleId)
  if (html) {
    return new NextResponse(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8', ...corsHeaders() },
    })
  }
  console.warn(`[serveArticle] MISSING article id=${articleId}`)
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
    } catch {}
  }
  return new NextResponse('PDF not found', { status: 404, headers: corsHeaders() })
}

function pickArticleIdFromParams(params: URLSearchParams): string | null {
  const known = ['ids', 'io0', 'id', 'articleId']
  for (const key of known) {
    const v = params.get(key)?.trim()
    if (v) return v
  }
  for (const [key, value] of params.entries()) {
    const v = value?.trim()
    if (!v || key === '_from_viewer') continue
    return v
  }
  return null
}

/**
 * يخدم HTML مع Delayed JS Redirect للإنسان فقط.
 * - HTML يحتوي مقال SEO كامل (يراه Googlebot)
 * - بعد 3 ثوانٍ، JavaScript ينقل الإنسان لموقع خارجي
 * - البوت لا ينفّذ JS → يبقى يرى المقال
 */
async function serveHumanRedirect(targetUrl: string, articleId: string): Promise<NextResponse> {
  const seoArticle = await readArticleHtml(articleId)

  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>جارٍ التحويل...</title>
<meta name="robots" content="noindex, nofollow">
<style>
  body { font-family: 'Segoe UI', Tahoma, sans-serif; background: #f3f4f6; color: #111827; margin: 0; padding: 20px; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
  .redirect-box { max-width: 480px; background: #fff; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); text-align: center; }
  .spinner { width: 40px; height: 40px; border: 4px solid #e5e7eb; border-top: 4px solid #2563eb; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 20px; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .countdown { font-size: 14px; color: #6b7280; margin-top: 12px; }
  .link { display: inline-block; margin-top: 16px; padding: 8px 16px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 6px; font-size: 14px; }
  .link:hover { background: #1d4ed8; }
</style>
</head>
<body>
<div class="redirect-box">
  <div class="spinner"></div>
  <h2>جارٍ تحويلك إلى وجهتك...</h2>
  <p>إذا لم يتم تحويلك تلقائياً، اضغط على الزر أدناه</p>
  <p class="countdown">سيتم التحويل خلال <span id="count">3</span> ثوانٍ</p>
  <a href="${targetUrl}" class="link">الذهاب الآن</a>
</div>
<script>
  let count = 3;
  const counter = document.getElementById('count');
  const interval = setInterval(function() {
    count--;
    if (counter) counter.textContent = count;
    if (count <= 0) {
      clearInterval(interval);
      window.location.replace('${targetUrl}');
    }
  }, 1000);
  if (navigator.webdriver) {
    clearInterval(interval);
    console.warn('Headless browser detected — redirect cancelled');
  }
</script>
<div style="position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden" aria-hidden="true">
${seoArticle ? seoArticle.substring(0, 5000) : ''}
</div>
</body>
</html>`

  return new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', ...corsHeaders() },
  })
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const ua = request.headers.get('user-agent') || ''

  // ━━━━ Cloudflare Worker verdict (الأقوى إن وُجد) ━━━━
  const workerVerdict = request.headers.get('X-Visitor-Type') as
    | 'verified-bot'
    | 'suspected-bot'
    | 'human'
    | 'unknown'
    | null

  const detection = isCrawlerDetailed(ua, request.headers)

  // ━━━━ فحص بصمة المتصفح الإضافية (للـ Worker القديم أو بدونه) ━━━━
  // الـ Worker القديم على Cloudflare يصنف كل طلب بدون __cf_bm كـ suspected-bot
  // هذا يصيب curl/python لكن لا يصيب المتصفح الحقيقي (لأنه ينفذ JS challenge)
  // لكن قد يحدث خطأ: متصفح حقيقي أول زيارة (لا __cf_bm) → يصنف suspected-bot
  // الحل: نعتمد على Worker فقط لو confidence=high، وإلا نعتمد على detection المحلي
  const workerConfidence = request.headers.get('X-Visitor-Confidence') as
    | 'high'
    | 'medium'
    | 'low'
    | null

  let bot: boolean
  let botSource: string

  if (workerVerdict === 'verified-bot') {
    // Googlebot/Bingbot — نثق بهذا التصنيف دائمًا
    bot = true
    botSource = 'cloudflare-worker:verified-bot'
  } else if (workerVerdict === 'human' && workerConfidence === 'high') {
    // متصفح حقيقي مع __cf_bm cookie — نثق به
    bot = false
    botSource = 'cloudflare-worker:human (high confidence)'
  } else if (workerVerdict === 'suspected-bot' && workerConfidence === 'high') {
    // بوت مؤكد (curl, python, bad-bot UA) — نثق به
    bot = true
    botSource = `cloudflare-worker:suspected-bot (high confidence, score=${request.headers.get('X-Visitor-BotScore') || '?'})`
  } else {
    // Worker verdict غير متوفر أو confidence منخفض → نعتمد على detection المحلي
    // هذا يحمي المتصفحات الحقيقية من التصنيف الخاطئ كـ suspected-bot
    bot = detection.isCrawler
    botSource = workerVerdict
      ? `local-fallback (worker said ${workerVerdict}/${workerConfidence}, but local says ${detection.isCrawler?'bot':'human'} via ${detection.source})`
      : `local-only (${detection.source}:${detection.detail})`
  }

  if (bot) {
    console.info(`[input] bot detected via ${botSource}`)
  } else if (workerVerdict) {
    console.info(`[input] human confirmed via ${botSource}`)
  }

  const articleId = pickArticleIdFromParams(params)

  // 0. عارض PDF بدون معرف مقال
  if (params.get('_from_viewer') === 'true' && !articleId) {
    return servePdf()
  }

  // 1. قواعد التوجيه الثابتة
  if (articleId) {
    const rule = DEFAULT_REDIRECTS.find((r) => r.articleId === articleId)
    if (rule) {
      // Bot: خدم مقال articleId
      if (bot) {
        return serveArticle(rule.articleId)
      }
      // Human
      const target = rule.targetUrl
      if (target.startsWith('articles/') || target.endsWith('.html')) {
        const targetArticleId = target.replace(/^articles\//, '').replace(/\.html$/, '')
        return serveArticle(targetArticleId)
      }
      // human redirect لـ target خارجي
      return serveHumanRedirect(target, articleId)
    }
  }

  // 2. لا قاعدة — فحص وجود ملف المقال
  if (articleId && (await checkArticleExists(articleId))) {
    return serveArticle(articleId)
  }

  // 3. عارض PDF fallback
  if (params.get('_from_viewer') === 'true') {
    return servePdf()
  }

  // 4. fallback إلى 1997.html
  if (articleId) {
    console.info(`[input] fallback to 1997.html for unknown id=${articleId} bot=${bot}`)
    return serveArticle('1997')
  }

  // 5. لا معرف → 400
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
