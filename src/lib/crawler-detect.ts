/**
 * Crawler/bot/AI-agent detection with Cloudflare Bot Management support.
 *
 * ثلاث طبقات للكشف:
 * 1. Cloudflare Bot Management headers (الأقوى — يتطلب تفعيل Bot Fight Mode)
 * 2. crawler-detect npm package (قاعدة بيانات ضخمة من UA المعروفة)
 * 3. Regex fallback (AI crawlers + search engines)
 *
 * كيف يعمل Cloudflare Bot Management:
 * - Cloudflare يحقن JSD script في كل صفحة (يضيفه هذا الكود تلقائيًا في كل HTML)
 * - السكربت ينشئ iframe مخفي يحمل /cdn-cgi/challenge-platform/scripts/jsd/main.js
 * - main.js يضع cookie __cf_bm في المتصفح
 * - البوت لا ينفّذ JS → لا cookie → الطلب التالي يُرسل مع header:
 *     cf-bot: true        (Bot Management Pro)
 *     cf-bm: false        (Bot Management Free / Bot Fight Mode)
 * - هذا الكود يقرأ هذه الـ headers أولاً قبل أي فحص UA
 */
import * as crawlerDetectPkg from 'crawler-detect'

// Search-engine crawlers + generic bot substrings (lower-cased UA match).
const FALLBACK_BOTS = [
  'googlebot',
  'bingbot',
  'slurp',
  'duckduckbot',
  'baiduspider',
  'yandexbot',
  'facebookexternalhit',
  'twitterbot',
  'pinterestbot',
  'discordbot',
  'linkedinbot',
  'applebot',
  'bytespider',
  'semrushbot',
  'ahrefsbot',
  'mj12bot',
  'dotbot',
  'petalbot',
  'sogou',
  'exabot',
  'ia_archiver',
  'mediapartners-google',
  'adsbot-google',
  'googlebot-image',
  'googlebot-news',
  'googlebot-video',
  'crawler',
  'spider',
  'bot/',
  'bot;',
  // --- AI training / agent crawlers ---
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
  'timpibot',
  'youbot',
  'piplbot',
  'zoominfobot',
  'aihitbot',
  'researchscan',
  'awariorssbot',
]

function fallbackIsCrawler(ua: string): boolean {
  const lower = (ua || '').toLowerCase()
  if (!lower) return false
  return FALLBACK_BOTS.some((b) => lower.includes(b))
}

// Lazily resolve the package's isCrawler function.
let detectorFn: ((ua: string) => boolean) | null = null
let detectorTried = false
function getDetector(): ((ua: string) => boolean) | null {
  if (detectorTried) return detectorFn
  detectorTried = true
  try {
    const fn = (crawlerDetectPkg as any).isCrawler
    if (typeof fn === 'function') {
      detectorFn = (ua: string) => !!fn(ua)
      return detectorFn
    }
  } catch {
    // package misbehaves at runtime — fall through to regex
  }
  return null
}

/**
 * Cloudflare Bot Management headers detection.
 *
 * هذه الـ headers يضيفها Cloudflare تلقائيًا لكل طلب يمر عبره:
 *
 * - cf-bot: "true" | "false"
 *     (Bot Management Pro/Enterprise — تصنيف Cloudflare الرسمي)
 *
 * - cf-bm: "true" | "false"
 *     (Bot Fight Mode Free — كشف أساسي يعتمد على __cf_bm cookie)
 *
 * - cf-verified-bot: "true"
 *     (Bot Management — للبوتات الموثقة مثل Googlebot)
 *
 * - cf-threat-score: <number>
 *     (0-100 — درجة الخطر، >10 غالبًا بوت)
 *
 * ملاحظة: الـ headers تأتي بصيغة lowercase من Cloudflare،
 * لكن `headers.get()` في Next.js case-insensitive.
 */
function getCfBotVerdict(headers: Headers): { isBot: boolean; source: string; score?: number } | null {
  // cf-bot: "true" — أقوى إشارة (Bot Management Pro)
  const cfBot = headers.get('cf-bot')
  if (cfBot === 'true') return { isBot: true, source: 'cf-bot' }
  if (cfBot === 'false') return { isBot: false, source: 'cf-bot' }

  // cf-bm: "false" تعني أن الـ __cf_bm cookie غير موجود = بوت
  // (لأن JSD script يضع هذا الـ cookie في المتصفح، والبوت لا ينفّذ JS)
  const cfBm = headers.get('cf-bm')
  if (cfBm === 'false') return { isBot: true, source: 'cf-bm-missing' }
  if (cfBm === 'true') return { isBot: false, source: 'cf-bm-present' }

  // cf-threat-score: درجة الخطر (0-100)
  const threatScore = headers.get('cf-threat-score')
  if (threatScore !== null) {
    const score = parseInt(threatScore, 10)
    if (!isNaN(score)) {
      // score > 10 = بوت محتمل وفقًا لـ Cloudflare documentation
      if (score > 10) return { isBot: true, source: 'cf-threat-score', score }
      // score === 0 = إنسان موثوق
      if (score === 0) return { isBot: false, source: 'cf-threat-score', score }
    }
  }

  // لا توجد إشارات Cloudflare → الموقع ليس خلف Cloudflare، أو Bot Management غير مفعّل
  return null
}

export interface CrawlerDetectionResult {
  isCrawler: boolean
  source: 'cloudflare' | 'crawler-detect' | 'regex-fallback'
  detail: string
  cfScore?: number
}

/**
 * الكشف الشامل عن البوت — يستخدم Cloudflare أولاً ثم UA fallback.
 *
 * @param userAgent  User-Agent header
 * @param headers    كائن Headers الكامل (للحصول على cf-* headers)
 */
export function isCrawlerDetailed(
  userAgent: string | null | undefined,
  headers?: Headers | null
): CrawlerDetectionResult {
  // 1. Cloudflare Bot Management (الأقوى إن وُجد)
  if (headers) {
    const cf = getCfBotVerdict(headers)
    if (cf) {
      return {
        isCrawler: cf.isBot,
        source: 'cloudflare',
        detail: cf.source,
        cfScore: cf.score,
      }
    }
  }

  const ua = userAgent || ''

  // 2. crawler-detect npm package
  const detector = getDetector()
  if (detector) {
    try {
      if (detector(ua)) {
        return { isCrawler: true, source: 'crawler-detect', detail: 'matched-package-db' }
      }
    } catch {
      // fall through
    }
  }

  // 3. Regex fallback
  if (fallbackIsCrawler(ua)) {
    return { isCrawler: true, source: 'regex-fallback', detail: 'matched-ua-substring' }
  }

  return { isCrawler: false, source: 'regex-fallback', detail: 'no-match' }
}

/**
 * Backwards-compatible API: isCrawler(ua, headers?) → boolean
 *
 * يستخدم isCrawlerDetailed داخليًا لكن يرجع boolean فقط.
 */
export function isCrawler(
  userAgent: string | null | undefined,
  headers?: Headers | null
): boolean {
  return isCrawlerDetailed(userAgent, headers).isCrawler
}

/**
 * Extracts the "real" client IP from a request, honouring common proxy headers.
 * The original server sat behind Cloudflare, so `cf-connecting-ip` wins.
 */
export function getClientIp(headers: Headers): string {
  return (
    headers.get('cf-connecting-ip') ||
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip') ||
    '0.0.0.0'
  )
}
