/**
 * Cloudflare Worker — TDS Bot Detection Layer
 *
 * يُنشر على Cloudflare Edge (الأقرب جغرافيًا للمستخدم)
 * يفحص بصمة المتصفح المتطورة قبل وصول الطلب لـ Vercel
 *
 * ثلاث طبقات فحص:
 * 1. Cloudflare headers (cf-bot, cf-bm, cf-threat-score)
 * 2. Browser fingerprint signals (cookie, TLS, HTTP/2)
 * 3. Behavioral analysis (request patterns)
 *
 * النتيجة: توجيه الطلب لـ Vercel مع header صريح:
 *   X-Visitor-Type: verified-bot    (Googlebot, Bingbot, إلخ)
 *   X-Visitor-Type: suspected-bot   (cloaking attempts, scrapers)
 *   X-Visitor-Type: human           (متصفح حقيقي)
 *   X-Visitor-Type: unknown         (افتراضي — يُعامَل كإنسان للأمان)
 *
 * النشر:
 *   1. Cloudflare dashboard → Workers & Pages → Create Worker
 *   2. الصق هذا الكود → Deploy
 *   3. Workers Routes → Add route: j.uctm.edu.trackpoint.sbs/*
 *   4. ربط Worker بهذا الـ route
 */

// قائمة بوتات محركات البحث الموثقة (تظهر في Google Jobs)
const VERIFIED_BOTS = [
  'googlebot',
  'googlebot-image',
  'googlebot-news',
  'googlebot-video',
  'mediapartners-google',
  'adsbot-google',
  'bingbot',
  'bingpreview',
  'slurp',          // Yahoo
  'duckduckbot',
  'baiduspider',
  'yandexbot',
  'facebookexternalhit',
  'twitterbot',
  'linkedinbot',
  'applebot',
  'pinterestbot',
]

// بوتات AI (قد نعاملها كبوت أو إنسان حسب السياسة)
const AI_BOTS = [
  'gptbot',
  'chatgpt-user',
  'oai-searchbot',
  'claudebot',
  'claude-web',
  'anthropic-ai',
  'perplexitybot',
  'perplexity-user',
  'ccbot',
  'google-extended',
  'meta-externalagent',
  'meta-externalfetcher',
  'diffbot',
  'cohere-ai',
  'ai2bot',
  'imagesiftbot',
  'applebot-extended',
  'amazonbot',
]

// بوتات scrapers ضارة (نحجبها أو نخدمها محتوى ضعيف)
const BAD_BOTS = [
  'semrushbot',
  'ahrefsbot',
  'mj12bot',
  'dotbot',
  'petalbot',
  'bytespider',
  'researchscan',
  'awariorssbot',
  'youbot',
  'piplbot',
  'zoominfobot',
  'aihitbot',
]

function getBotTier(userAgent) {
  const ua = (userAgent || '').toLowerCase()
  if (!ua) return 'unknown'

  // أولًا: بوتات ضارة
  for (const b of BAD_BOTS) {
    if (ua.includes(b)) return 'bad-bot'
  }

  // ثانيًا: بوتات موثقة
  for (const b of VERIFIED_BOTS) {
    if (ua.includes(b)) return 'verified-bot'
  }

  // ثالثًا: بوتات AI
  for (const b of AI_BOTS) {
    if (ua.includes(b)) return 'ai-bot'
  }

  return 'unknown'
}

/**
 * يحسب "درجة البوت" من 0 (إنسان) إلى 100 (بوت مؤكد)
 * باستخدام بصمة المتصفح المتطورة.
 */
function calculateBotScore(request, cf) {
  let score = 0
  const reasons = []

  const ua = request.headers.get('user-agent') || ''
  const cookie = request.headers.get('cookie') || ''

  // ━━━━ 1. Cloudflare Bot Management headers ━━━━
  const cfBot = request.headers.get('cf-bot')
  if (cfBot === 'true') {
    score += 50
    reasons.push('cf-bot:true')
  } else if (cfBot === 'false') {
    score -= 30
    reasons.push('cf-bot:false')
  }

  // cf-bm: false يعني أن __cf_bm cookie غير موجود (البوت لا ينفذ JS)
  const cfBm = request.headers.get('cf-bm')
  if (cfBm === 'false') {
    score += 35
    reasons.push('cf-bm:false (no __cf_bm cookie)')
  } else if (cfBm === 'true') {
    score -= 25
    reasons.push('cf-bm:true')
  }

  // __cf_bm cookie check مباشرة
  if (!cookie.includes('__cf_bm')) {
    score += 25
    reasons.push('no __cf_bm cookie in Cookie header')
  } else {
    score -= 20
    reasons.push('__cf_bm cookie present')
  }

  // ━━━━ 2. cf-threat-score (Enterprise) ━━━━
  const threatScore = parseInt(request.headers.get('cf-threat-score') || '0', 10)
  if (!isNaN(threatScore)) {
    if (threatScore > 50) {
      score += 40
      reasons.push(`threat-score:${threatScore}`)
    } else if (threatScore > 10) {
      score += 20
      reasons.push(`threat-score:${threatScore}`)
    } else if (threatScore === 0) {
      score -= 15
      reasons.push('threat-score:0 (clean)')
    }
  }

  // ━━━━ 3. TLS Fingerprint (JA3) ━━━━
  const tlsVersion = cf?.tlsVersion || ''
  if (tlsVersion && !['TLSv1.2', 'TLSv1.3'].includes(tlsVersion)) {
    score += 30
    reasons.push(`old TLS: ${tlsVersion}`)
  }

  // ━━━━ 4. HTTP/2 settings fingerprint ━━━━
  // Browser Chrome/Firefox/Safari يستخدم HTTP/2 دائمًا
  // Curl/Python يستخدم HTTP/1.1 غالبًا
  const cfVisitor = request.headers.get('cf-visitor') || ''
  if (!cfVisitor.includes('"h2"') && !cfVisitor.includes('http2')) {
    score += 15
    reasons.push('no HTTP/2')
  }

  // ━━━━ 5. Behavioral: missing headers ━━━━
  // المتصفح الحقيقي يرسل: Accept, Accept-Language, Accept-Encoding, sec-ch-ua
  const acceptLanguage = request.headers.get('accept-language')
  if (!acceptLanguage) {
    score += 15
    reasons.push('no accept-language')
  }

  const secChUa = request.headers.get('sec-ch-ua')
  if (!secChUa && ua.includes('Chrome')) {
    // Chrome دائمًا يرسل sec-ch-ua
    score += 25
    reasons.push('Chrome UA but no sec-ch-ua header (suspicious)')
  }

  // ━━━━ 6. suspicious UA patterns ━━━━
  if (ua.includes('python') || ua.includes('curl') || ua.includes('wget') || ua.includes('scrapy')) {
    score += 50
    reasons.push(`script UA: ${ua.substring(0, 50)}`)
  }

  if (ua.includes('headless')) {
    score += 60
    reasons.push('headless browser')
  }

  // ━━━━ 7. cf.botManagement.score (إذا متوفر) ━━━━
  const bmScore = cf?.botManagement?.score
  if (typeof bmScore === 'number') {
    if (bmScore > 30) {
      score += 30
      reasons.push(`botManagement.score:${bmScore}`)
    }
  }

  return { score: Math.max(0, Math.min(100, score)), reasons }
}

/**
 * يقرر نوع الزائر النهائي بناءً على UA + بصمة المتصفح.
 */
function classifyVisitor(request) {
  const ua = request.headers.get('user-agent') || ''
  const cf = request.cf || {}
  const botTier = getBotTier(ua)
  const { score, reasons } = calculateBotScore(request, cf)

  // ━━━━ verified-bot (Googlebot) ━━━━
  if (botTier === 'verified-bot') {
    return {
      type: 'verified-bot',
      confidence: 'high',
      botScore: score,
      reasons: [`UA:${botTier}`, ...reasons],
    }
  }

  // ━━━━ bad-bot → نعامله كبوت لكن لا نحجبه (نخدمه محتوى SEO فقط) ━━━━
  if (botTier === 'bad-bot') {
    return {
      type: 'suspected-bot',
      confidence: 'high',
      botScore: Math.max(score, 80),
      reasons: [`UA:${botTier}`, ...reasons],
    }
  }

  // ━━━━ ai-bot ━━━━
  if (botTier === 'ai-bot') {
    return {
      type: 'suspected-bot',
      confidence: 'medium',
      botScore: Math.max(score, 60),
      reasons: [`UA:${botTier}`, ...reasons],
    }
  }

  // ━━━━ unknown UA → نعتمد على بصمة المتصفح ━━━━
  if (score >= 50) {
    return {
      type: 'suspected-bot',
      confidence: 'medium',
      botScore: score,
      reasons: ['high bot score', ...reasons],
    }
  }

  if (score <= 20) {
    return {
      type: 'human',
      confidence: 'high',
      botScore: score,
      reasons: ['low bot score', ...reasons],
    }
  }

  // منطقة رمادية (20-50)
  return {
    type: 'human', // للأمان: نعامله كإنسان حتى لا نفقد زوار حقيقيين
    confidence: 'low',
    botScore: score,
    reasons: ['gray zone, treating as human', ...reasons],
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)

    // ━━━━ استثناء: Cloudflare challenge endpoints ━━━━
    if (url.pathname.startsWith('/cdn-cgi/')) {
      return fetch(request)
    }

    // ━━━━ استثناء: Vercel internals ━━━━
    if (url.pathname.startsWith('/_next/')) {
      return fetch(request)
    }

    // ━━━━ تصنيف الزائر ━━━━
    const verdict = classifyVisitor(request)

    // Log (يظهر في Cloudflare Workers logs)
    console.log(JSON.stringify({
      ts: new Date().toISOString(),
      path: url.pathname,
      ua: (request.headers.get('user-agent') || '').substring(0, 80),
      visitor: verdict.type,
      confidence: verdict.confidence,
      botScore: verdict.botScore,
      reasons: verdict.reasons,
      country: request.cf?.country,
      ip: request.headers.get('cf-connecting-ip'),
    }))

    // ━━━━ بناء طلب جديد للـ Vercel ━━━━
    const newHeaders = new Headers(request.headers)
    newHeaders.set('X-Visitor-Type', verdict.type)
    newHeaders.set('X-Visitor-Confidence', verdict.confidence)
    newHeaders.set('X-Visitor-BotScore', String(verdict.botScore))
    newHeaders.set('X-Visitor-Reasons', verdict.reasons.slice(0, 5).join('|'))

    const newRequest = new Request(request, { headers: newHeaders })

    // ━━━━ تمرير الطلب لـ Vercel ━━━━
    return fetch(newRequest)
  },
}
