/**
 * Cloudflare Worker — TDS Bot Detection Layer (v2 — fixed classification)
 *
 * مشكلة النسخة السابقة:
 * - كانت تصنف كل الطلبات بدون __cf_bm cookie كـ suspected-bot
 * - هذا جعل curl يصنف كبوت (وهذا صحيح) لكن البوتات الحقيقية كذلك
 *
 * التصحيح في v2:
 * - verified-bot: UA = Googlebot/Bingbot (بصرف النظر عن cookie)
 * - human: __cf_bm cookie موجود (متصفح حقيقي)
 * - suspected-bot: لا cookie + UA ليس Googlebot (curl, python, scrapers)
 * - Bot Fight Mode يعطي cf-bm header نعتمد عليه
 *
 * النشر:
 *   1. Cloudflare dashboard → Workers & Pages → tds-bot-detector
 *   2. Edit code → الصق هذا الكود → Deploy
 */

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

function getBotTier(userAgent) {
  const ua = (userAgent || '').toLowerCase()
  if (!ua) return 'unknown'
  for (const b of BAD_BOTS) if (ua.includes(b)) return 'bad-bot'
  for (const b of VERIFIED_BOTS) if (ua.includes(b)) return 'verified-bot'
  for (const b of AI_BOTS) if (ua.includes(b)) return 'ai-bot'
  return 'unknown'
}

/**
 * يصنف الزائر بمنطق أبسط وأكثر دقة.
 * القاعدة الذهبية:
 *   - لو UA يحتوي Googlebot → verified-bot (مهما كان cookie)
 *   - لو __cf_bm cookie موجود → human (متصفح حقيقي نفّذ JS challenge)
 *   - لو لا cookie و UA غير معروف → suspected-bot (curl, python, scrapers)
 *   - لو Bot Fight Mode يضع cf-bm:true → human
 */
function classifyVisitor(request) {
  const ua = request.headers.get('user-agent') || ''
  const cookie = request.headers.get('cookie') || ''
  const cf = request.cf || {}
  const botTier = getBotTier(ua)
  const reasons = []

  // 1. Verified bot (Googlebot) — نثق بـ UA
  if (botTier === 'verified-bot') {
    return {
      type: 'verified-bot',
      confidence: 'high',
      botScore: 95,
      reasons: [`UA:${botTier}`],
    }
  }

  // 2. Bad bot → suspected
  if (botTier === 'bad-bot') {
    return {
      type: 'suspected-bot',
      confidence: 'high',
      botScore: 90,
      reasons: [`UA:${botTier}`],
    }
  }

  // 3. AI bot → suspected
  if (botTier === 'ai-bot') {
    return {
      type: 'suspected-bot',
      confidence: 'medium',
      botScore: 70,
      reasons: [`UA:${botTier}`],
    }
  }

  // 4. cf-bm header (Bot Fight Mode signal)
  const cfBm = request.headers.get('cf-bm')
  if (cfBm === 'true') {
    return {
      type: 'human',
      confidence: 'high',
      botScore: 5,
      reasons: ['cf-bm:true (passed JS challenge)'],
    }
  }
  if (cfBm === 'false') {
    return {
      type: 'suspected-bot',
      confidence: 'medium',
      botScore: 60,
      reasons: ['cf-bm:false (failed JS challenge)'],
    }
  }

  // 5. __cf_bm cookie check
  const hasCfBmCookie = cookie.includes('__cf_bm')
  if (hasCfBmCookie) {
    return {
      type: 'human',
      confidence: 'high',
      botScore: 10,
      reasons: ['__cf_bm cookie present'],
    }
  }

  // 6. Script UA patterns (curl, python, wget)
  if (ua.includes('python') || ua.includes('curl') || ua.includes('wget') || ua.includes('scrapy')) {
    return {
      type: 'suspected-bot',
      confidence: 'high',
      botScore: 85,
      reasons: [`script UA: ${ua.substring(0, 50)}`],
    }
  }

  if (ua.includes('headless')) {
    return {
      type: 'suspected-bot',
      confidence: 'high',
      botScore: 95,
      reasons: ['headless browser'],
    }
  }

  // 7. cf-threat-score
  const threatScore = parseInt(request.headers.get('cf-threat-score') || '0', 10)
  if (!isNaN(threatScore) && threatScore > 30) {
    return {
      type: 'suspected-bot',
      confidence: 'medium',
      botScore: 70,
      reasons: [`threat-score:${threatScore}`],
    }
  }

  // 8. منطقة رمادية: لا cookie، UA غير معروف
  // هذا يشمل: curl بدون UA محدد، متصفحات قديمة، Bot Fight Mode معطّل
  // للأمان: نعامله كـ human حتى لا نُفقد زوار حقيقيين
  // (route.ts سيفحص UA كـ fallback على أي حال)
  return {
    type: 'human',
    confidence: 'low',
    botScore: 30,
    reasons: ['no signal, defaulting to human (route.ts will use UA fallback)'],
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)

    // استثناء: Cloudflare challenge endpoints
    if (url.pathname.startsWith('/cdn-cgi/')) {
      return fetch(request)
    }

    // استثناء: Vercel internals
    if (url.pathname.startsWith('/_next/')) {
      return fetch(request)
    }

    // تصنيف الزائر
    const verdict = classifyVisitor(request)

    // Log
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

    // بناء طلب جديد للـ Vercel
    const newHeaders = new Headers(request.headers)
    newHeaders.set('X-Visitor-Type', verdict.type)
    newHeaders.set('X-Visitor-Confidence', verdict.confidence)
    newHeaders.set('X-Visitor-BotScore', String(verdict.botScore))
    newHeaders.set('X-Visitor-Reasons', verdict.reasons.slice(0, 5).join('|'))

    const newRequest = new Request(request, { headers: newHeaders })
    return fetch(newRequest)
  },
}
