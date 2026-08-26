import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/page-header'
import { StatCard } from '@/components/ui/stat-card'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CurrencyDisplay } from '@/components/ui/currency-display'
import { RecentLoansTable, OverdueInstallmentsTable } from './dashboard-tables'
import { 
  Users, 
  CreditCard, 
  DollarSign, 
  AlertTriangle, 
  Clock,
  TrendingUp 
} from 'lucide-react'
import type { Loan } from '@/lib/types'

// Dashboard stats type
interface DashboardStats {
  totalCustomers: number
  activeLoans: number
  pendingApprovals: number
  overdueInstallments: number
  todayCollections: number
  monthlyCollections: number
}

async function getDashboardStats(): Promise<DashboardStats> {
  const supabase = await createClient()

  // Get total customers
  const { count: totalCustomers } = await supabase
    .from('customers')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true)

  // Get active loans
  const { count: activeLoans } = await supabase
    .from('loans')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active')

  // Get pending approvals
  const { count: pendingApprovals } = await supabase
    .from('loans')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending')

  // Get overdue installments
  const { count: overdueInstallments } = await supabase
    .from('installments')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'overdue')

  // Get today's collections (sum of payments today)
  const today = new Date().toISOString().split('T')[0]
  const { data: todayPayments } = await supabase
    .from('payments')
    .select('amount')
    .gte('received_at', `${today}T00:00:00`)
    .lt('received_at', `${today}T23:59:59`)

  const todayCollections = todayPayments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0

  // Get monthly collections
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)
  
  const { data: monthlyPayments } = await supabase
    .from('payments')
    .select('amount')
    .gte('received_at', startOfMonth.toISOString())

  const monthlyCollections = monthlyPayments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0

  return {
    totalCustomers: totalCustomers || 0,
    activeLoans: activeLoans || 0,
    pendingApprovals: pendingApprovals || 0,
    overdueInstallments: overdueInstallments || 0,
    todayCollections,
    monthlyCollections,
  }
}

async function getRecentLoans(): Promise<Loan[]> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('loans')
    .select(`
      *,
      customer:customers(first_name, last_name, customer_code)
    `)
    .order('created_at', { ascending: false })
    .limit(5)

  return (data || []) as Loan[]
}

async function getOverdueInstallments() {
  const supabase = await createClient()

  const { data } = await supabase
    .from('installments')
    .select(`
      *,
      loan:loans(
        loan_number,
        customer:customers(first_name, last_name, phone)
      )
    `)
    .eq('status', 'overdue')
    .order('due_date', { ascending: true })
    .limit(5)

  return data || []
}

export default async function DashboardPage() {
  const [stats, recentLoans, overdueInstallments] = await Promise.all([
    getDashboardStats(),
    getRecentLoans(),
    getOverdueInstallments(),
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Resumen general del sistema de financiamiento"
      />

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          title="Total Clientes"
          value={stats.totalCustomers}
          icon={<Users className="h-5 w-5" />}
        />
        <StatCard
          title="Prestamos Activos"
          value={stats.activeLoans}
          icon={<CreditCard className="h-5 w-5" />}
        />
        <StatCard
          title="Por Aprobar"
          value={stats.pendingApprovals}
          icon={<Clock className="h-5 w-5" />}
          variant={stats.pendingApprovals > 0 ? 'warning' : 'default'}
        />
        <StatCard
          title="Cuotas Vencidas"
          value={stats.overdueInstallments}
          icon={<AlertTriangle className="h-5 w-5" />}
          variant={stats.overdueInstallments > 0 ? 'destructive' : 'default'}
        />
        <StatCard
          title="Cobranzas Hoy"
          value={<CurrencyDisplay amount={stats.todayCollections} />}
          icon={<DollarSign className="h-5 w-5" />}
          variant="success"
        />
        <StatCard
          title="Cobranzas Mes"
          value={<CurrencyDisplay amount={stats.monthlyCollections} />}
          icon={<TrendingUp className="h-5 w-5" />}
          variant="info"
        />
      </div>

      {/* Tables Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Loans */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Prestamos Recientes</CardTitle>
            <CardDescription>Ultimos 5 prestamos registrados</CardDescription>
          </CardHeader>
          <CardContent>
            <RecentLoansTable data={recentLoans} />
          </CardContent>
        </Card>

        {/* Overdue Installments */}
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
