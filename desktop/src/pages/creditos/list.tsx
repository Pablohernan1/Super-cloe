import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Filter } from 'lucide-react'
import { CreditLimitTable } from './credit-limits-table'
import { useAuth } from '@/lib/auth-context'
import { canManageCreditLimits } from '@/lib/permissions'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ShieldAlert } from 'lucide-react'

export default function CreditLimitsPage() {
  const { profile } = useAuth()
  const [limits, setLimits] = useState<any[]>([])
  const [filteredLimits, setFilteredLimits] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const canManage = canManageCreditLimits(profile?.role as any)

  const fetchLimits = async () => {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('credit_limits')
        .select(`*, customer:customer_id ( id, first_name, last_name, customer_code, cuit_cuil )`)
        .order('created_at', { ascending: false })

      setLimits(data || [])
    } catch (error) {
      console.error('Error fetching credit limits:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (statusFilter === 'all') {
      setFilteredLimits(limits)
    } else {
      setFilteredLimits(limits.filter((l) => l.status === statusFilter))
    }
  }, [limits, statusFilter])

  useEffect(() => {
    fetchLimits()
  }, [])

  if (profile && !canManage) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Límites de Crédito" description="Gestión de límites de crédito por cliente" />
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertDescription>
            Esta sección es exclusiva de supervisor y administrador. Si necesitás ver el disponible de un cliente
            puntual, buscalo desde Inicio o su ficha de cliente.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  const totalLimits = limits.length
  const approvedLimits = limits.filter((l) => l.status === 'approved').length
  const pendingLimits = limits.filter((l) => l.status === 'pending_approval').length
  const totalApprovedAmount = limits.filter((l) => l.status === 'approved').reduce((sum, l) => sum + l.approved_limit, 0)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Límites de Crédito" description="Gestión de límites de crédito por cliente">
        {canManage && (
          <Link to="/creditos/nuevo">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Límite
            </Button>
          </Link>
        )}
      </PageHeader>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{totalLimits}</div>
            <p className="text-xs text-muted-foreground">Total Límites</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">{approvedLimits}</div>
            <p className="text-xs text-muted-foreground">Aprobados</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-yellow-600">{pendingLimits}</div>
            <p className="text-xs text-muted-foreground">Pendientes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-lg font-bold">${totalApprovedAmount.toLocaleString('es-AR')}</div>
            <p className="text-xs text-muted-foreground">Monto Total Aprobado</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-4 items-center">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="pending_approval">Pendiente Aprobación</SelectItem>
            <SelectItem value="approved">Aprobado</SelectItem>
            <SelectItem value="rejected">Rechazado</SelectItem>
            <SelectItem value="suspended">Suspendido</SelectItem>
            <SelectItem value="expired">Expirado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Cargando...</div>
          ) : (
            <CreditLimitTable limits={filteredLimits} onRefresh={fetchLimits} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
