import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { PageHeader } from '@/components/ui/page-header'
import { StatCard } from '@/components/ui/stat-card'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CurrencyDisplay } from '@/components/ui/currency-display'
import { RecentLoansTable, OverdueInstallmentsTable } from './dashboard-tables'
import { QuickSearch } from './quick-search'
import { Users, CreditCard, DollarSign, AlertTriangle, Clock, TrendingUp } from 'lucide-react'

interface DashboardStats {
  totalCustomers: number
  activeLoans: number
  pendingApprovals: number
  overdueInstallments: number
  todayCollections: number
  monthlyCollections: number
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalCustomers: 0,
    activeLoans: 0,
    pendingApprovals: 0,
    overdueInstallments: 0,
    todayCollections: 0,
    monthlyCollections: 0,
  })
  const [recentLoans, setRecentLoans] = useState<any[]>([])
  const [overdueInstallments, setOverdueInstallments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const [
        { count: totalCustomers },
        { count: activeLoans },
        { count: pendingApprovals },
        { count: overdueCount },
      ] = await Promise.all([
        supabase.from('customers').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('loans').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('credit_limits').select('*', { count: 'exact', head: true }).eq('status', 'pending_approval'),
        supabase.from('installments').select('*', { count: 'exact', head: true }).eq('status', 'overdue'),
      ])

      const today = new Date().toISOString().split('T')[0]
      const { data: todayPayments } = await supabase
        .from('payments')
        .select('amount')
        .gte('received_at', `${today}T00:00:00`)
        .lt('received_at', `${today}T23:59:59`)

      const startOfMonth = new Date()
      startOfMonth.setDate(1)
      startOfMonth.setHours(0, 0, 0, 0)
      const { data: monthlyPayments } = await supabase
        .from('payments')
        .select('amount')
        .gte('received_at', startOfMonth.toISOString())

      const { data: loans } = await supabase
        .from('loans')
        .select('*, customer:customer_id(first_name, last_name, customer_code)')
        .order('created_at', { ascending: false })
        .limit(5)

      const { data: overdue } = await supabase
        .from('installments')
        .select('*, loan:loans(loan_number, customer:customer_id(first_name, last_name, phone))')
        .eq('status', 'overdue')
        .order('due_date', { ascending: true })
        .limit(5)

      setStats({
        totalCustomers: totalCustomers || 0,
        activeLoans: activeLoans || 0,
        pendingApprovals: pendingApprovals || 0,
        overdueInstallments: overdueCount || 0,
        todayCollections: todayPayments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0,
        monthlyCollections: monthlyPayments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0,
      })
      setRecentLoans(loans || [])
      setOverdueInstallments(overdue || [])
      setLoading(false)
    }

    load()
  }, [])

  if (loading) {
    return <div className="p-6 text-muted-foreground">Cargando...</div>
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Inicio" description="Buscá un cliente por CUIT/CUIL para ver su situación al instante" />

      <QuickSearch />

      <div>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Resumen general</h2>
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
          <Link to="/clientes" className="block transition-transform hover:-translate-y-0.5">
            <StatCard title="Total Clientes" value={stats.totalCustomers} icon={<Users className="h-5 w-5" />} />
          </Link>
          <Link to="/prestamos" className="block transition-transform hover:-translate-y-0.5">
            <StatCard title="Prestamos Activos" value={stats.activeLoans} icon={<CreditCard className="h-5 w-5" />} />
          </Link>
          <Link to="/creditos" className="block transition-transform hover:-translate-y-0.5">
            <StatCard
              title="Por Aprobar"
              value={stats.pendingApprovals}
              icon={<Clock className="h-5 w-5" />}
              variant={stats.pendingApprovals > 0 ? 'warning' : 'default'}
            />
          </Link>
          <Link to="/alertas" className="block transition-transform hover:-translate-y-0.5">
            <StatCard
              title="Cuotas Vencidas"
              value={stats.overdueInstallments}
              icon={<AlertTriangle className="h-5 w-5" />}
              variant={stats.overdueInstallments > 0 ? 'destructive' : 'default'}
            />
          </Link>
          <Link to="/cobranza" className="block transition-transform hover:-translate-y-0.5">
            <StatCard
              title="Cobranzas Hoy"
              value={<CurrencyDisplay amount={stats.todayCollections} />}
              icon={<DollarSign className="h-5 w-5" />}
              variant="success"
            />
          </Link>
          <Link to="/cobranza" className="block transition-transform hover:-translate-y-0.5">
            <StatCard
              title="Cobranzas Mes"
              value={<CurrencyDisplay amount={stats.monthlyCollections} />}
              icon={<TrendingUp className="h-5 w-5" />}
              variant="info"
            />
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Prestamos Recientes</CardTitle>
            <CardDescription>Ultimos 5 prestamos registrados</CardDescription>
          </CardHeader>
          <CardContent>
            <RecentLoansTable data={recentLoans} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Cuotas Vencidas</CardTitle>
            <CardDescription>Requieren atencion inmediata</CardDescription>
          </CardHeader>
          <CardContent>
            <OverdueInstallmentsTable data={overdueInstallments} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
