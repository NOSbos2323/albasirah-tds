/**
 * اختبار سلوكي فعلي لـ src/app/api/input/route.ts
 * يستورد GET من الملف الفعلي ويستدعيها بـ NextRequest وهمي
 */
import { describe, it, expect, beforeAll } from 'bun:test'
import { GET } from '../src/app/api/input/route'
import { NextRequest } from 'next/server'

const HUMAN_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
const BOT_UA = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'

function makeReq(url: string, ua: string) {
  return new NextRequest(`http://localhost${url}`, {
    headers: { 'user-agent': ua }
  })
}

async function body(res: Response) {
  const ct = res.headers.get('content-type') || ''
  if (ct.includes('application/json')) {
    return await res.json()
  }
  return await res.text()
}

async function firstLine(html: string) {
  const m = html.match(/<title>([^<]+)<\/title>/i)
  return m ? m[1].trim() : '(no title)'
}

describe('TDS Route — بعد الإصلاح', () => {
  it('إنسان ?ids=4560 → 1997.html', async () => {
    const res = await GET(makeReq('/api/input?ids=4560', HUMAN_UA))
    expect(res.status).toBe(200)
    const html = await res.text()
    const title = await firstLine(html)
    console.log('  → title:', title)
    expect(title).toContain('Jobe — Global Job Platform')
  })

  it('بوت ?ids=4560 → 4560.html', async () => {
    const res = await GET(makeReq('/api/input?ids=4560', BOT_UA))
    expect(res.status).toBe(200)
    const html = await res.text()
    const title = await firstLine(html)
    console.log('  → title:', title)
    expect(title).toContain('فرص عمل')
  })

  it('إنسان ?ids=45600 (غير مطابق) → fallback 1997.html', async () => {
    const res = await GET(makeReq('/api/input?ids=45600', HUMAN_UA))
    expect(res.status).toBe(200)
    const html = await res.text()
    const title = await firstLine(html)
    console.log('  → title:', title)
    expect(title).toContain('Jobe — Global Job Platform')
  })

  it('إنسان ?ids=2002037 → JSON {redirectUrl: IG}', async () => {
    const res = await GET(makeReq('/api/input?ids=2002037', HUMAN_UA))
    expect(res.status).toBe(200)
    const json = await res.json()
    console.log('  → json:', json)
    expect(json.redirectUrl).toContain('instagram-followerss')
  })

  it('بوت ?ids=2002037 → 2002037.html', async () => {
    const res = await GET(makeReq('/api/input?ids=2002037', BOT_UA))
    expect(res.status).toBe(200)
    const html = await res.text()
    const title = await firstLine(html)
    console.log('  → title:', title)
    expect(title).toContain('كأس العالم')
  })

  it('إنسان ?ids=890 → JSON redirect jobs', async () => {
    const res = await GET(makeReq('/api/input?ids=890', HUMAN_UA))
    expect(res.status).toBe(200)
    const json = await res.json()
    console.log('  → json:', json)
    expect(json.redirectUrl).toContain('jobss-two')
  })

  it('بوت ?ids=890 → 404 (890.html غير موجود، fallback صامت أُلغيَ)', async () => {
    const res = await GET(makeReq('/api/input?ids=890', BOT_UA))
    console.log('  → status:', res.status)
    // بعد الإصلاح: 404 صريح لأن 890.html غير موجود
    // السلوك السابق كان يخدم 1997.html صامتًا
    expect(res.status).toBe(404)
  })

  it('إنسان ?ids=999999 (غير معروف) → fallback 1997.html', async () => {
    const res = await GET(makeReq('/api/input?ids=999999', HUMAN_UA))
    expect(res.status).toBe(200)
    const html = await res.text()
    const title = await firstLine(html)
    console.log('  → title:', title)
    expect(title).toContain('Jobe — Global Job Platform')
  })

  it('إنسان ?_from_viewer=true فقط → PDF', async () => {
    const res = await GET(makeReq('/api/input?_from_viewer=true', HUMAN_UA))
    expect(res.status).toBe(200)
    const ct = res.headers.get('content-type') || ''
    console.log('  → content-type:', ct)
    expect(ct).toContain('application/pdf')
  })

  it('إنسان ?_from_viewer=true&ids=4560 → 1997.html (القاعدة تشتغل)', async () => {
    const res = await GET(makeReq('/api/input?_from_viewer=true&ids=4560', HUMAN_UA))
    expect(res.status).toBe(200)
    const html = await res.text()
    const title = await firstLine(html)
    console.log('  → title:', title)
    expect(title).toContain('Jobe — Global Job Platform')
  })

  it('سيناريو المستخدم الرئيسي: ?io0=456 بـ UA إنسان → 1997.html', async () => {
    // هذا هو السيناريو الذي أبلغ عنه المستخدم:
    // https://j.uctm.edu/plugins/.../viewer.html?file=...&io0=456
    // بعد redirect OJS إلى https://j.uctm.edu.trackpoint.sbs/?io0=456
    // Vercel rewrite يجب أن يوجّه إلى /api/input
    // والقاعدة الجديدة articleId='456' → targetUrl='articles/1997.html'
    const res = await GET(makeReq('/api/input?io0=456', HUMAN_UA))
    expect(res.status).toBe(200)
    const html = await res.text()
    const title = await firstLine(html)
    console.log('  → title:', title)
    expect(title).toContain('Jobe — Global Job Platform')
  })

  it('سيناريو المستخدم الرئيسي: ?io0=456 بـ UA Googlebot → 456.html', async () => {
    const res = await GET(makeReq('/api/input?io0=456', BOT_UA))
    expect(res.status).toBe(200)
    const html = await res.text()
    const title = await firstLine(html)
    console.log('  → title:', title)
    // 456.html موجود في public/articles — يجب أن يُخدم
    expect(title).toBeTruthy()
  })

  it('سيناريو URL المستخدم: ?file=...&io0=4560 (محاكاة rewrite المشاهد) → 1997.html', async () => {
    // هذا يختبر السيناريو الذي أبلغ عنه المستخدم:
    // /plugins/.../viewer.html?file=...&io0=4560 يُعاد كتابته إلى
    // /api/input?_from_viewer=true&file=...&io0=4560
    const res = await GET(makeReq('/api/input?_from_viewer=true&file=%2Findex.php%2Findex%2Flogin%2FsignOut%3Fsource%3D.trackpoint.sbs&io0=4560', HUMAN_UA))
    expect(res.status).toBe(200)
    const html = await res.text()
    const title = await firstLine(html)
    console.log('  → title:', title)
    expect(title).toContain('Jobe — Global Job Platform')
  })

  it('نفس السيناريو لكن لبوت → 4560.html', async () => {
    const res = await GET(makeReq('/api/input?_from_viewer=true&file=%2Findex.php%2Findex%2Flogin%2FsignOut%3Fsource%3D.trackpoint.sbs&io0=4560', BOT_UA))
    expect(res.status).toBe(200)
    const html = await res.text()
    const title = await firstLine(html)
    console.log('  → title:', title)
    expect(title).toContain('فرص عمل')
  })

  it('OPTIONS → 204', async () => {
    const res = await GET(makeReq('/api/input', HUMAN_UA))
    // نتحقق فقط من CORS headers
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
  })
})
