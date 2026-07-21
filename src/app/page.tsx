import { prisma } from '@/lib/db';

export default async function HomePage() {
  const [rules, ips, clicks, users, posts] = await Promise.all([
    prisma.redirectRule.findMany(),
    prisma.knownIp.findMany(),
    prisma.clickLog.findMany({ take: 100 }),
    prisma.user.findMany(),
    prisma.post.findMany(),
  ]);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">لوحة البيانات</h1>

        {/* جدول قواعل التوجيه */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-4">قواعل التوجيه ({rules.length})</h2>
          <div className="overflow-x-auto bg-white rounded-lg shadow">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-100 border-b">
                  <th className="px-4 py-2 text-right">المعامل</th>
                  <th className="px-4 py-2 text-right">القيمة</th>
                  <th className="px-4 py-2 text-right">الرابط المستهدف</th>
                  <th className="px-4 py-2 text-right">النقرات</th>
                  <th className="px-4 py-2 text-right">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {rules.length > 0 ? (
                  rules.map((rule) => (
                    <tr key={rule.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-2">{rule.parameterName}</td>
                      <td className="px-4 py-2">{rule.parameterValue}</td>
                      <td className="px-4 py-2 text-blue-600 truncate">{rule.targetUrl}</td>
                      <td className="px-4 py-2">{rule.clicks}</td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-1 rounded ${rule.active ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}`}>
                          {rule.active ? 'مفعل' : 'معطل'}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-4 py-2 text-center text-gray-500">
                      لا توجد بيانات
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* جدول عناوين IP */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-4">عناوين IP المعروفة ({ips.length})</h2>
          <div className="overflow-x-auto bg-white rounded-lg shadow">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-100 border-b">
                  <th className="px-4 py-2 text-right">عنوان IP</th>
                  <th className="px-4 py-2 text-right">تاريخ الإضافة</th>
                </tr>
              </thead>
              <tbody>
                {ips.length > 0 ? (
                  ips.map((ip) => (
                    <tr key={ip.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-2 font-mono">{ip.ip}</td>
                      <td className="px-4 py-2">{new Date(ip.createdAt).toLocaleDateString('ar-SA')}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={2} className="px-4 py-2 text-center text-gray-500">
                      لا توجد بيانات
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* جدول سجل النقرات */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-4">سجل النقرات (آخر {clicks.length})</h2>
          <div className="overflow-x-auto bg-white rounded-lg shadow">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-100 border-b">
                  <th className="px-4 py-2 text-right">معرف المقالة</th>
                  <th className="px-4 py-2 text-right">الرابط</th>
                  <th className="px-4 py-2 text-right">عنوان IP</th>
                  <th className="px-4 py-2 text-right">التاريخ</th>
                </tr>
              </thead>
              <tbody>
                {clicks.length > 0 ? (
                  clicks.map((click) => (
                    <tr key={click.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-2">{click.articleId}</td>
                      <td className="px-4 py-2 text-blue-600 truncate">{click.targetUrl}</td>
                      <td className="px-4 py-2 font-mono">{click.ip}</td>
                      <td className="px-4 py-2">{new Date(click.createdAt).toLocaleString('ar-SA')}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-4 py-2 text-center text-gray-500">
                      لا توجد بيانات
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* جدول المستخدمين */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-4">المستخدمون ({users.length})</h2>
          <div className="overflow-x-auto bg-white rounded-lg shadow">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-100 border-b">
                  <th className="px-4 py-2 text-right">الاسم</th>
                  <th className="px-4 py-2 text-right">البريد الإلكتروني</th>
                  <th className="px-4 py-2 text-right">تاريخ الإنشاء</th>
                </tr>
              </thead>
              <tbody>
                {users.length > 0 ? (
                  users.map((user) => (
                    <tr key={user.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-2">{user.name || '-'}</td>
                      <td className="px-4 py-2">{user.email}</td>
                      <td className="px-4 py-2">{new Date(user.createdAt).toLocaleDateString('ar-SA')}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="px-4 py-2 text-center text-gray-500">
                      لا توجد بيانات
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* جدول المنشورات */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-4">المنشورات ({posts.length})</h2>
          <div className="overflow-x-auto bg-white rounded-lg shadow">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-100 border-b">
                  <th className="px-4 py-2 text-right">العنوان</th>
                  <th className="px-4 py-2 text-right">معرف الكاتب</th>
                  <th className="px-4 py-2 text-right">النشر</th>
                  <th className="px-4 py-2 text-right">التاريخ</th>
                </tr>
              </thead>
              <tbody>
                {posts.length > 0 ? (
                  posts.map((post) => (
                    <tr key={post.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-2 font-semibold">{post.title}</td>
                      <td className="px-4 py-2">{post.authorId}</td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-1 rounded ${post.published ? 'bg-green-200 text-green-800' : 'bg-gray-200 text-gray-800'}`}>
                          {post.published ? 'منشور' : 'مسودة'}
                        </span>
                      </td>
                      <td className="px-4 py-2">{new Date(post.createdAt).toLocaleDateString('ar-SA')}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-4 py-2 text-center text-gray-500">
                      لا توجد بيانات
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
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

export default function Dashboard() {
  const [rules, setRules] = useState<RedirectRule[]>([])
  const [logs, setLogs] = useState<ClickLog[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('overview')

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/admin/rules')
      const data = await response.json()

      if (data.success) {
        setRules(data.rules || [])
        setLogs(data.logs || [])
        setStats(data.stats)
      } else {
        setError(data.error || 'فشل في تحميل البيانات')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ غير متوقع')
      console.error('[v0] Error fetching data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30000) // تحديث كل 30 ثانية
    return () => clearInterval(interval)
  }, [])

  const handleDeleteRule = async (id: string) => {
    if (!confirm('هل تريد حقاً حذف هذه القاعدة؟')) return

    try {
      const response = await fetch(`/api/admin/rules?id=${id}`, {
        method: 'DELETE',
      })
      const data = await response.json()

      if (data.success) {
        setRules(rules.filter(r => r.id !== id))
      } else {
        setError(data.error || 'فشل في حذف القاعدة')
      }
    } catch (err) {
      console.error('[v0] Error deleting rule:', err)
      setError('فشل في حذف القاعدة')
    }
  }

  const handleToggleActive = async (rule: RedirectRule) => {
    try {
      const response = await fetch('/api/admin/rules', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: rule.id,
          active: !rule.active,
        }),
      })
      const data = await response.json()

      if (data.success) {
        setRules(rules.map(r => (r.id === rule.id ? { ...r, active: !r.active } : r)))
      }
    } catch (err) {
      console.error('[v0] Error toggling rule:', err)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* رأس الصفحة */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">لوحة التحكم</h1>
          <p className="text-slate-400">إدارة قواعد التوجيه والإحصائيات</p>
        </div>

        {/* رسالة الخطأ */}
        {error && (
          <div className="mb-6 bg-red-900/30 border border-red-700 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-200">خطأ</p>
              <p className="text-red-100 text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* الإحصائيات */}
        {stats && !loading && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <Card className="bg-slate-900 border-slate-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-400">إجمالي القواعد</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalRules}</div>
              </CardContent>
            </Card>

            <Card className="bg-slate-900 border-slate-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-400">القواعس النشطة</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-400">{stats.activeRules}</div>
              </CardContent>
            </Card>

            <Card className="bg-slate-900 border-slate-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-400">إجمالي النقرات</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-400">{stats.totalClicks}</div>
              </CardContent>
            </Card>

            <Card className="bg-slate-900 border-slate-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-400">عناوين IP فريدة</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-400">{stats.uniqueIps}</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* الأزرار */}
        <div className="flex gap-2 mb-6">
          <Button
            onClick={fetchData}
            disabled={loading}
            className="gap-2 bg-slate-800 hover:bg-slate-700"
          >
            <RefreshCw className="w-4 h-4" />
            تحديث البيانات
          </Button>
          <Button className="gap-2 bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4" />
            إضافة قاعدة جديدة
          </Button>
        </div>

        {/* الجداول */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* جدول القواعس */}
          <Card className="lg:col-span-2 bg-slate-900 border-slate-700">
            <CardHeader>
              <CardTitle>قواعس التوجيه</CardTitle>
              <CardDescription>جميع قواعس التوجيه المحفوظة</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-slate-400">جاري التحميل...</div>
              ) : rules.length === 0 ? (
                <div className="text-center py-8 text-slate-400">لا توجد قواعس بعد</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="text-left py-3 px-2">المعامل</th>
                        <th className="text-left py-3 px-2">القيمة</th>
                        <th className="text-left py-3 px-2">المقال</th>
                        <th className="text-left py-3 px-2">النقرات</th>
                        <th className="text-left py-3 px-2">الحالة</th>
                        <th className="text-left py-3 px-2">الإجراءات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rules.map(rule => (
                        <tr key={rule.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                          <td className="py-3 px-2 font-mono text-xs">{rule.parameterName}</td>
                          <td className="py-3 px-2 font-mono text-xs">{rule.parameterValue}</td>
                          <td className="py-3 px-2 font-mono text-xs">{rule.articleId}</td>
                          <td className="py-3 px-2">{rule.clicks}</td>
                          <td className="py-3 px-2">
                            <Badge
                              className={rule.active ? 'bg-green-600' : 'bg-slate-600'}
                            >
                              {rule.active ? 'نشطة' : 'معطلة'}
                            </Badge>
                          </td>
                          <td className="py-3 px-2">
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleToggleActive(rule)}
                                className="h-8"
                              >
                                {rule.active ? 'إيقاف' : 'تفعيل'}
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleDeleteRule(rule.id)}
                                className="h-8"
                              >
                                حذف
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

          {/* سجل النقرات */}
          <Card className="bg-slate-900 border-slate-700">
            <CardHeader>
              <CardTitle className="text-lg">آخر النقرات</CardTitle>
              <CardDescription>أحدث 50 نقرة</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-slate-400">جاري التحميل...</div>
              ) : logs.length === 0 ? (
                <div className="text-center py-8 text-slate-400">لا توجد نقرات بعد</div>
              ) : (
                <div className="space-y-3">
                  {logs.map(log => (
                    <div key={log.id} className="bg-slate-800/50 p-3 rounded border border-slate-700">
                      <p className="text-xs font-mono text-blue-400 mb-1">{log.articleId}</p>
                      <p className="text-xs text-slate-400 truncate">{log.ip}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        {new Date(log.createdAt).toLocaleString('ar-SA')}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
