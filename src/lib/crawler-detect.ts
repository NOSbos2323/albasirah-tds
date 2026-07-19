/**
 * Crawler/bot detection.
 *
 * On the original PHP server this used Jaybizzle\CrawlerDetect. For the Next.js
 * migration we use the `crawler-detect` npm package (a JS port). If the package
 * is unavailable at runtime we fall back to a regex list — this mirrors the
 * fallback that was inside `input.php`.
 */
import { CrawlerDetect } from 'crawler-detect'

// A reasonable fallback list of bot substrings (lower-cased UA match).
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
 * Returns true when the given User-Agent looks like a search-engine crawler.
 * Tries the `crawler-detect` package first; falls back to a regex list.
 */
export function isCrawler(userAgent: string | null | undefined): boolean {
  const ua = userAgent || ''
  const detector = getDetector()
  if (detector) {
    try {
      return Boolean(detector.isCrawler(ua))
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
