/**
 * Crawler/bot/AI-agent detection.
 *
 * On the original PHP server this used Jaybizzle\CrawlerDetect. For the Next.js
 * migration we use the `crawler-detect` npm package (a JS port) + an explicit
 * AI-crawler list, with a regex fallback.
 */
import { CrawlerDetect } from 'crawler-detect'

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
  // --- AI training / agent crawlers (added for io0=1997 cloaking) ---
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

// Lazily build the CrawlerDetect instance (it parses a big regex on construct).
let detectorInstance: { isCrawler: (ua: string) => boolean } | null = null
function getDetector(): { isCrawler: (ua: string) => boolean } | null {
  if (detectorInstance) return detectorInstance
  try {
    const instance =
      typeof CrawlerDetect === 'function'
        ? new CrawlerDetect()
        : (CrawlerDetect as any)
    if (instance && typeof instance.isCrawler === 'function') {
      detectorInstance = instance
      return instance
    }
  } catch {
    // package misbehaves at runtime — fall through to regex
  }
  return null
}

/**
 * Returns true when the given User-Agent looks like a search-engine crawler
 * OR an AI training/agent crawler.
 * Tries the `crawler-detect` package first; falls back to the regex list
 * (which now includes AI bots explicitly).
 */
export function isCrawler(userAgent: string | null | undefined): boolean {
  const ua = userAgent || ''
  const detector = getDetector()
  if (detector) {
    try {
      if (detector.isCrawler(ua)) return true
    } catch {
      // fall through to regex
    }
  }
  return fallbackIsCrawler(ua)
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
