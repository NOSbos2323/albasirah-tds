# نظام TDS — البصيرة (Next.js / Vercel)

نظام توزيع الزوار (Traffic Distribution System) المُرحّل من PHP إلى Next.js 16.

## كيف يعمل النظام

كل طلب يأتي على `/api/input?ids=<articleId>` يمرّ بالمنطق التالي:

1. **كشف البوت** من User-Agent (عبر `crawler-detect`).
2. **إن كان محرّك بحث** → يُعرض مقال HTML ثابت من `/public/articles/<ids>.html`
   (هذا هو الـ cloaking لأجل SEO — جوجل يرى محتوى حقيقياً).
3. **إن كان زائر بشري**:
   - تُبحث عن قاعدة توجيه نشطة لذاك المعرّف في قاعدة البيانات.
   - وُجدت → يُعاد `{"redirectUrl": "..."}` (وسكربت `good.js` يقوم بـ `location.replace`).
   - لم تُوجد → يُعرض المقال.
4. **تسجيل النقرة** مرة واحدة لكل IP فريد (مثل المنطق القديم في `input.php`).

## المسارات

| المسار القديم (PHP) | المسار الجديد (Next.js) | الوصف |
|---|---|---|
| `/server/input.php?ids=X` | `/api/input?ids=X` | منطق TDS |
| `/server/good.js` | `/server/good.js` | سكربت العميل (ثابت، دون تغيير) |
| `/articles/X.html` | `/articles/X.html` | مقالات HTML ثابتة |
| `data/clicks.log` | جدول `ClickLog` | سجل النقرات |
| `data/ips.txt` | جدول `KnownIp` | عناوين IP الفريدة |
| — | `/api/stats` | إحصائيات اللوحة |
| — | `/api/redirects` | إدارة قواعد التوجيه (CRUD) |
| — | `/api/articles` | قائمة المقالات |
| — | `/api/test-crawler` | اختبار القرار دون تسجيل |
| — | `/` | لوحة التحكم |

> ملاحظة: `next.config.ts` يعيد كتابة `/server/input.php` → `/api/input`، فيعمل
> سكربت `good.js` القديم دون أي تعديل.

## التشغيل محلياً

```bash
bun install
cp .env.example .env
bun run db:push          # ينشئ قاعدة SQLite محلية
bun run scripts/seed-redirects.ts   # يزرع قواعد التوجيه الافتراضية
bun run dev              # http://localhost:3000
```

## النشر على Vercel

1. ارفع هذا المستودع إلى GitHub واربطه بـ Vercel.
2. في إعدادات المشروع على Vercel، أضف متغير البيئة `DATABASE_URL` بقاعدة بيانات
   حقيقية (يُنصح بـ **Vercel Postgres** أو **Neon** أو **Supabase**).
3. بدّل مزوّد Prisma من `sqlite` إلى `postgresql` في `prisma/schema.prisma`:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
4. بعد أول نشر شغّل الهجرة:
   ```bash
   npx prisma db push
   # أو: npx prisma migrate deploy
   ```
   ثم ازرع القواعد الافتراضية:
   ```bash
   bun run scripts/seed-redirects.ts
   ```
5. (اختياري) إن كان `good.js` يشير إلى دومين قديم مثل `trackpoint.sb`، حدّثه إلى
   دومينك الجديد على Vercel.

## لماذا توقف النظام القديم على Vercel

- **PHP غير مدعوم** على Vercel — كان `input.php` يُخدم كنص خام.
- **نظام الملفات للقراءة فقط** — التسجيل في `data/*.log` لا يُحفظ.
- **إعادة كتابة شاملة معطّلة** في `vercel.json` كانت تعيد كل المسارات إلى PDF.

## التقنيات

Next.js 16 · TypeScript · Tailwind CSS 4 · shadcn/ui · Prisma · crawler-detect
