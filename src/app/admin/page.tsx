'use client'

import * as React from 'react'
import { 
  Plus, 
  Trash2, 
  Power, 
  ExternalLink, 
  RefreshCw, 
  BarChart3, 
  Link2, 
  Globe, 
  ShieldCheck, 
  BookOpen, 
  History,
  TrendingUp,
  UserCheck,
  Search,
  FileText
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Toaster } from '@/components/ui/sonner'
import { toast } from 'sonner'

interface RedirectRule {
  id: string
  parameterName: string
  articleId: string
  targetUrl: string
  note?: string
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
  ua?: string
  createdAt: string
}

interface Stats {
  totalRules: number
  activeRules: number
  totalClicks: number
  uniqueIps: number
}

export default function AdminPage() {
  const [rules, setRules] = React.useState<RedirectRule[]>([])
  const [logs, setLogs] = React.useState<ClickLog[]>([])
  const [articles, setArticles] = React.useState<string[]>([])
  const [stats, setStats] = React.useState<Stats>({
    totalRules: 0,
    activeRules: 0,
    totalClicks: 0,
    uniqueIps: 0,
  })
  const [loading, setLoading] = React.useState(true)
  const [refreshing, setRefreshing] = React.useState(false)

  // Form State
  const [parameterName, setParameterName] = React.useState('io0')
  const [articleId, setArticleId] = React.useState('')
  const [targetUrl, setTargetUrl] = React.useState('')
  const [note, setNote] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)

  // Search Filter
  const [searchTerm, setSearchTerm] = React.useState('')

  const fetchArticles = async () => {
    try {
      const res = await fetch('/api/admin/articles')
      const data = await res.json()
      if (data.success) {
        setArticles(data.articles || [])
      }
    } catch (err) {
      console.error('Failed to load articles:', err)
    }
  }

  const fetchData = async (showToast = false) => {
    try {
      setRefreshing(true)
      const res = await fetch('/api/admin/rules')
      const data = await res.json()
      if (data.success) {
        setRules(data.rules || [])
        setLogs(data.logs || [])
        setStats(data.stats || { totalRules: 0, activeRules: 0, totalClicks: 0, uniqueIps: 0 })
        if (showToast) {
          toast.success('تم تحديث البيانات بنجاح | Data updated successfully')
        }
      } else {
        toast.error('فشل تحميل البيانات: ' + data.error)
      }
    } catch (err: any) {
      toast.error('حدث خطأ في الاتصال بالخادم')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  React.useEffect(() => {
    const timer = setTimeout(() => {
      fetchData()
      fetchArticles()
    }, 0)
    return () => clearTimeout(timer)
  }, [])

  const handleAddRule = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!articleId.trim() || !targetUrl.trim()) {
      toast.warning('يرجى ملء جميع الحقول المطلوبة | Please fill in all required fields')
      return
    }

    try {
      setSubmitting(true)
      const res = await fetch('/api/admin/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          parameterName: parameterName.trim() || 'io0',
          articleId: articleId.trim(), 
          targetUrl: targetUrl.trim(), 
          note,
          active: false // Default to inactive/disabled, shows article without redirect until explicitly enabled!
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('تمت إضافة قاعدة التوجيه بنجاح وهي معطلة افتراضياً | Rule added successfully (offline by default)')
        setArticleId('')
        setTargetUrl('')
        setNote('')
        fetchData()
      } else {
        toast.error(data.error || 'فشل إضافة القاعدة')
      }
    } catch (err) {
      toast.error('خطأ في الاتصال بالخادم')
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggleActive = async (rule: RedirectRule) => {
    try {
      const res = await fetch('/api/admin/rules', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: rule.id, active: !rule.active }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(`تم ${!rule.active ? 'تفعيل' : 'تعطيل'} القاعدة بنجاح`)
        setRules(rules.map((r) => (r.id === rule.id ? { ...r, active: !r.active } : r)))
        setStats({
          ...stats,
          activeRules: stats.activeRules + (!rule.active ? 1 : -1),
        })
      } else {
        toast.error(data.error || 'فشل تعديل حالة القاعدة')
      }
    } catch (err) {
      toast.error('خطأ في الاتصال')
    }
  }

  const handleDeleteRule = async (id: string) => {
    if (!confirm('هل أنت متأكد من رغبتك في حذف هذه القاعدة؟\nAre you sure you want to delete this rule?')) {
      return
    }

    try {
      const res = await fetch(`/api/admin/rules?id=${id}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (data.success) {
        toast.success('تم حذف القاعدة بنجاح | Rule deleted successfully')
        fetchData()
      } else {
        toast.error(data.error || 'فشل حذف القاعدة')
      }
    } catch (err) {
      toast.error('خطأ في الاتصال')
    }
  }

  const filteredRules = rules.filter(
    (r) =>
      r.articleId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.targetUrl.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.note && r.note.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans antialiased text-slate-800" dir="rtl">
      <Toaster position="top-center" />
      
      {/* Top Navigation / Header */}
      <div className="max-w-7xl mx-auto mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-xs border border-slate-100">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs py-0.5">
              نظام TDS نشط وفعّال
            </Badge>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
            لوحة تحكم نظام توزيع الزوار (TDS Dashboard)
          </h1>
          <p className="text-slate-500 text-sm mt-1" dir="ltr">
            Admin management console for Traffic Distribution and Cloaking rules.
          </p>
        </div>

        <div className="flex gap-2 w-full md:w-auto">
          <Button 
            onClick={() => fetchData(true)} 
            variant="outline" 
            disabled={refreshing}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-900 w-full md:w-auto justify-center"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            تحديث البيانات
          </Button>
          <Button 
            asChild
            variant="default"
            className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm flex items-center gap-2 w-full md:w-auto justify-center"
          >
            <a href="/plugins/generic/pdfJsViewer/pdf.js/web/viewer.html" target="_blank" rel="noopener noreferrer">
              <FileText className="w-4 h-4" />
              عرض غطاء الـ PDF
            </a>
          </Button>
        </div>
      </div>

      {/* Stats Counter Section */}
      <div className="max-w-7xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card className="bg-white border-slate-100 shadow-2xs hover:shadow-xs transition-all duration-200">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-xs md:text-sm font-medium text-slate-400">إجمالي القواعد</p>
              <h3 className="text-2xl md:text-3xl font-bold text-slate-900 mt-1">{loading ? '...' : stats.totalRules}</h3>
              <p className="text-xxs text-slate-400 mt-1" dir="ltr">Total Configured Rules</p>
            </div>
            <div className="p-3 rounded-xl bg-blue-50 text-blue-600">
              <Link2 className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-100 shadow-2xs hover:shadow-xs transition-all duration-200">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-xs md:text-sm font-medium text-slate-400">القواعد النشطة</p>
              <h3 className="text-2xl md:text-3xl font-bold text-emerald-600 mt-1">{loading ? '...' : stats.activeRules}</h3>
              <p className="text-xxs text-slate-400 mt-1" dir="ltr">Active Redirect Rules</p>
            </div>
            <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600">
              <ShieldCheck className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-100 shadow-2xs hover:shadow-xs transition-all duration-200">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-xs md:text-sm font-medium text-slate-400">إجمالي الزوار الفريدين</p>
              <h3 className="text-2xl md:text-3xl font-bold text-indigo-600 mt-1">{loading ? '...' : stats.uniqueIps}</h3>
              <p className="text-xxs text-slate-400 mt-1" dir="ltr">Unique Verified IPs</p>
            </div>
            <div className="p-3 rounded-xl bg-indigo-50 text-indigo-600">
              <UserCheck className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-100 shadow-2xs hover:shadow-xs transition-all duration-200">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-xs md:text-sm font-medium text-slate-400">نقرات التحويل</p>
              <h3 className="text-2xl md:text-3xl font-bold text-amber-600 mt-1">{loading ? '...' : stats.totalClicks}</h3>
              <p className="text-xxs text-slate-400 mt-1" dir="ltr">Total Clicks Redirected</p>
            </div>
            <div className="p-3 rounded-xl bg-amber-50 text-amber-600">
              <TrendingUp className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Panel Content */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Right side - Create Rule form and Articles List */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="bg-white border-slate-100 shadow-sm sticky top-6">
            <CardHeader className="border-b border-slate-50 pb-4">
              <CardTitle className="text-lg font-bold flex items-center gap-2 text-slate-900">
                <Plus className="w-5 h-5 text-indigo-600" />
                إضافة قاعدة تحويل جديدة
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">
                إضافة معامل ورابط تحويل مخصص لمقالة السيو مع التحكم الكامل في التوجيه.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleAddRule} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">
                    معامل الرابط (Query Parameter) *
                  </label>
                  <Input 
                    type="text" 
                    placeholder="مثال: io0" 
                    value={parameterName}
                    onChange={(e) => setParameterName(e.target.value)}
                    required
                    className="bg-slate-50/50 border-slate-200 focus:bg-white transition-all text-left font-mono"
                    dir="ltr"
                  />
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    <span className="text-[10px] text-slate-400 self-center ml-1">خيارات سريعة:</span>
                    {['io0', 'id', 'file', 'ids', 'ref'].map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setParameterName(p)}
                        className={`text-[10px] px-1.5 py-0.5 rounded border transition-all ${
                          parameterName === p 
                            ? 'bg-indigo-50 text-indigo-600 border-indigo-200 font-bold' 
                            : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">
                    معرف المقال (Article ID) *
                  </label>
                  {articles.length > 0 ? (
                    <div className="space-y-2">
                      <select
                        value={articleId}
                        onChange={(e) => setArticleId(e.target.value)}
                        className="w-full h-10 px-3 py-2 rounded-md border border-slate-200 bg-slate-50/50 text-sm focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 transition-all text-right font-medium"
                      >
                        <option value="">-- اختر مقالة سيو من القائمة --</option>
                        {articles.map((art) => (
                          <option key={art} value={art}>
                            {art}.html
                          </option>
                        ))}
                      </select>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-400">أو اكتب يدوياً:</span>
                        <Input 
                          type="text" 
                          placeholder="مثال: 456" 
                          value={articleId}
                          onChange={(e) => setArticleId(e.target.value)}
                          className="bg-slate-50/50 border-slate-200 focus:bg-white transition-all text-right h-8 text-xs font-mono"
                          dir="ltr"
                        />
                      </div>
                    </div>
                  ) : (
                    <Input 
                      type="text" 
                      placeholder="مثال: 456" 
                      value={articleId}
                      onChange={(e) => setArticleId(e.target.value)}
                      required
                      className="bg-slate-50/50 border-slate-200 focus:bg-white transition-all text-right font-mono"
                      dir="ltr"
                    />
                  )}
                  <p className="text-[10px] text-slate-400 mt-1">
                    سيتم تفعيل الرابط ليكون: <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-indigo-600">?{parameterName || 'io0'}={articleId || 'المعرف'}</code>
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">
                    رابط التوجيه المستهدف (Target URL) *
                  </label>
                  <Input 
                    type="text" 
                    placeholder="https://example.com/dest" 
                    value={targetUrl}
                    onChange={(e) => setTargetUrl(e.target.value)}
                    required
                    className="bg-slate-50/50 border-slate-200 focus:bg-white transition-all text-left"
                    dir="ltr"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    الرابط الذي سيتم نقل الزوار الحقيقيين إليه تلقائياً عند تفعيل القاعدة.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">
                    ملاحظة / وصف (اختياري)
                  </label>
                  <Input 
                    type="text" 
                    placeholder="مثال: حملة انستغرام - متابعين" 
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="bg-slate-50/50 border-slate-200 focus:bg-white transition-all text-right"
                  />
                </div>

                <Button 
                  type="submit" 
                  disabled={submitting} 
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 shadow-xs transition-all duration-150"
                >
                  {submitting ? 'جاري الحفظ...' : 'حفظ القاعدة ونشرها'}
                </Button>
                <p className="text-[10px] text-center text-amber-600 font-bold mt-2">
                  ⚠️ القاعدة تضاف "معطلة" افتراضياً، ولن يحدث أي توجيه للمقال إلا بعد تفعيلها يدوياً.
                </p>
              </form>
            </CardContent>
          </Card>

          {/* List of articles card */}
          <Card className="bg-white border-slate-100 shadow-sm">
            <CardHeader className="border-b border-slate-50 pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-900">
                <BookOpen className="w-4 h-4 text-indigo-600" />
                مقالات السيو المتاحة في المجلد ({articles.length})
              </CardTitle>
              <CardDescription className="text-xxs text-slate-400">
                انقر على أي مقال أدناه لتحديده تلقائياً في النموذج.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4">
              {articles.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">لا توجد مقالات HTML في مجلد articles</p>
              ) : (
                <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto pr-1">
                  {articles.map((art) => (
                    <button
                      key={art}
                      type="button"
                      onClick={() => setArticleId(art)}
                      className={`text-xs px-2.5 py-1 rounded-full border text-right transition-all font-mono hover:scale-105 active:scale-95 ${
                        articleId === art
                          ? 'bg-indigo-600 text-white border-indigo-700 font-bold'
                          : 'bg-indigo-50/50 text-indigo-700 border-indigo-100 hover:bg-indigo-100'
                      }`}
                    >
                      📄 {art}.html
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Left side - Tables and Controls (occupies 8 cols) */}
        <div className="lg:col-span-8 space-y-8">
          
          {/* Rules Section */}
          <Card className="bg-white border-slate-100 shadow-sm">
            <CardHeader className="border-b border-slate-50 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg font-bold flex items-center gap-2 text-slate-900">
                  <Globe className="w-5 h-5 text-indigo-600" />
                  قواعد التوجيه والمعاملات الحالية
                </CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  التحكم في معامل الرابط، مقالة السيو، والوجهة النهائية للمستخدمين.
                </CardDescription>
              </div>

              {/* Search Bar */}
              <div className="relative w-full md:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                <Input 
                  type="text" 
                  placeholder="بحث في القواعد..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-slate-50 pl-3 pr-9 py-1 text-xs h-9 rounded-lg border-slate-200 focus:bg-white"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
                  <RefreshCw className="w-8 h-8 animate-spin text-indigo-600" />
                  <span>جاري تحميل قواعد التوجيه...</span>
                </div>
              ) : filteredRules.length === 0 ? (
                <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
                  <Globe className="w-10 h-10 text-slate-200 mb-2" />
                  <p className="font-bold text-sm">لا توجد أي قواعد توجيه مطابقة</p>
                  <p className="text-xs text-slate-400">قم بإضافة قواعد جديدة من النموذج الجانبي.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-right border-collapse">
                    <thead>
                      <tr className="bg-slate-50/75 text-xs font-bold text-slate-500 border-b border-slate-100">
                        <th className="p-4">اسم المعامل (Param)</th>
                        <th className="p-4">المقال (SEO Article)</th>
                        <th className="p-4">رابط الوجهة المستهدفة (إذا كان نشطاً)</th>
                        <th className="p-4 text-center">النقرات</th>
                        <th className="p-4 text-center">الحالة</th>
                        <th className="p-4 text-center">إجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 text-xs">
                      {filteredRules.map((rule) => (
                        <tr key={rule.id} className="hover:bg-slate-50/50 transition-all duration-150 group">
                          <td className="p-4 font-mono font-bold text-indigo-600 select-all" dir="ltr">
                            {rule.parameterName || 'io0'}
                          </td>
                          <td className="p-4 font-mono font-bold text-slate-900 select-all" dir="ltr">
                            {rule.articleId}.html
                          </td>
                          <td className="p-4">
                            <div className="max-w-[150px] md:max-w-[220px] truncate font-mono text-slate-500 select-all" dir="ltr" title={rule.targetUrl}>
                              {rule.targetUrl}
                            </div>
                            {rule.note && (
                              <span className="text-[10px] text-slate-400 block mt-0.5 font-sans">
                                📝 {rule.note}
                              </span>
                            )}
                          </td>
                          <td className="p-4 text-center font-bold">
                            <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200">
                              {rule.clicks} نقرة
                            </Badge>
                          </td>
                          <td className="p-4 text-center">
                            <button
                              onClick={() => handleToggleActive(rule)}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all border cursor-pointer ${
                                rule.active 
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100/75' 
                                  : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100/75'
                              }`}
                              title={rule.active ? "الزوار الحقيقيين سيتم توجيههم" : "الزوار سيرون المقال فقط في نفس الرابط دون توجيه"}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${rule.active ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                              {rule.active ? 'توجيه نشط' : 'عرض مقال فقط'}
                            </button>
                          </td>
                          <td className="p-4 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                asChild
                                size="icon"
                                variant="ghost"
                                className="w-7 h-7 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700"
                                title="اختبار الرابط / Test Link"
                              >
                                <a 
                                  href={`/plugins/generic/pdfJsViewer/pdf.js/web/viewer.html?${rule.parameterName || 'io0'}=${rule.articleId}`} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              </Button>

                              <Button
                                onClick={() => handleDeleteRule(rule.id)}
                                size="icon"
                                variant="ghost"
                                className="w-7 h-7 text-rose-500 hover:bg-rose-50 hover:text-rose-600"
                                title="حذف القاعدة / Delete Rule"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Click Logs Section */}
          <Card className="bg-white border-slate-100 shadow-sm">
            <CardHeader className="border-b border-slate-50 pb-4">
              <CardTitle className="text-lg font-bold flex items-center gap-2 text-slate-900">
                <History className="w-5 h-5 text-indigo-600" />
                آخر عمليات التحويل والنقرات (Click Logs)
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">
                متابعة حركة المرور الفورية للزوار الحقيقيين المحولين.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-12 text-center text-slate-400">
                  جاري تحميل السجلات...
                </div>
              ) : logs.length === 0 ? (
                <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-1">
                  <History className="w-8 h-8 text-slate-200 mb-1" />
                  <p className="font-bold text-sm">لا توجد أي نقرات مسجلة بعد</p>
                  <p className="text-xs text-slate-400">ستظهر نقرات التحويل للزوار هنا مباشرة.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-right border-collapse">
                    <thead>
                      <tr className="bg-slate-50/75 text-xs font-bold text-slate-500 border-b border-slate-100">
                        <th className="p-4">الوقت</th>
                        <th className="p-4">المعرف (Article ID)</th>
                        <th className="p-4">IP الزائر</th>
                        <th className="p-4">المتصفح (User Agent)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 text-xs">
                      {logs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50/50 transition-all duration-150">
                          <td className="p-4 text-slate-500 font-mono" dir="ltr">
                            {new Date(log.createdAt).toLocaleDateString('ar-EG', {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit'
                            })}
                          </td>
                          <td className="p-4 font-mono font-bold text-slate-900">
                            {log.articleId}
                          </td>
                          <td className="p-4 font-mono text-slate-600 select-all" dir="ltr">
                            {log.ip}
                          </td>
                          <td className="p-4 text-slate-400 max-w-[200px] truncate" title={log.ua || ''}>
                            {log.ua || 'N/A'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  )
}
