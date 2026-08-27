import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { DollarSign, TrendingUp, ShieldAlert } from 'lucide-react'
import { CreditLimitActions } from './credit-limit-actions'
import { useAuth } from '@/lib/auth-context'
import { canManageCreditLimits } from '@/lib/permissions'

const statusColors: Record<string, string> = {
  pending_approval: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  suspended: 'bg-orange-100 text-orange-800',
  expired: 'bg-gray-100 text-gray-800',
}

const statusLabels: Record<string, string> = {
  pending_approval: 'Pendiente Aprobación',
  approved: 'Aprobado',
  rejected: 'Rechazado',
  suspended: 'Suspendido',
  expired: 'Expirado',
}

export default function CreditLimitDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { profile } = useAuth()
  const [creditLimit, setCreditLimit] = useState<any>(null)
  const [auditHistory, setAuditHistory] = useState<any[]>([])
  const [loans, setLoans] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const { data: cl } = await supabase
      .from('credit_limits')
      .select(`*, customer:customer_id ( id, first_name, last_name, customer_code, cuit_cuil, status, person_type, razon_social )`)
      .eq('id', id)
      .single()

    setCreditLimit(cl)

    if (cl) {
      const [{ data: audit }, { data: relatedLoans }] = await Promise.all([
        supabase
          .from('audit_logs')
          .select('*')
          .eq('table_name', 'credit_limits')
          .eq('record_id', id)
          .order('created_at', { ascending: false }),
        supabase
          .from('loans')
          .select('id, loan_number, principal_amount, total_amount, status, disbursement_date, created_at')
          .eq('customer_id', cl.customer_id)
          .in('status', ['active', 'approved'])
          .order('created_at', { ascending: false }),
      ])
      setAuditHistory(audit || [])
      setLoans(relatedLoans || [])
    }
    setLoading(false)
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner className="h-6 w-6" />
      </div>
    )
  }

  if (!creditLimit) {
    return <div className="p-6 text-muted-foreground">Límite de crédito no encontrado</div>
  }

  if (profile && !canManageCreditLimits(profile.role as any)) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Límite de Crédito" backHref="/creditos" />
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertDescription>Esta sección es exclusiva de supervisor y administrador.</AlertDescription>
        </Alert>
      </div>
    )
  }

  const customerName =
    creditLimit.customer.person_type === 'juridica' && creditLimit.customer.razon_social
      ? creditLimit.customer.razon_social
      : `${creditLimit.customer.first_name} ${creditLimit.customer.last_name}`

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Detalle de Límite de Crédito" description={`Cliente: ${customerName}`} backHref="/creditos">
        <Badge className={statusColors[creditLimit.status] || statusColors.pending_approval}>
          {statusLabels[creditLimit.status] || creditLimit.status}
        </Badge>
      </PageHeader>

      {creditLimit.status === 'pending_approval' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-900 mb-3">Acciones disponibles:</p>
          <CreditLimitActions creditLimit={creditLimit} userRole={profile?.role || null} onDone={load} />
        </div>
      )}

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Límite Aprobado</span>
            </div>
            <div className="text-2xl font-bold mt-2">${creditLimit.approved_limit.toLocaleString('es-AR')}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Comprometido</span>
            </div>
            <div className="text-2xl font-bold mt-2">${creditLimit.committed_limit.toLocaleString('es-AR')}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-green-600" />
              <span className="text-sm text-muted-foreground">Disponible</span>
            </div>
            <div className="text-2xl font-bold text-green-600 mt-2">${creditLimit.available_credit.toLocaleString('es-AR')}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Información del Cliente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <span className="text-sm text-muted-foreground">Nombre</span>
              <p className="font-medium">{customerName}</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">CUIT/CUIL</span>
              <p className="font-medium">{creditLimit.customer.cuit_cuil}</p>
            </div>
            <Link to={`/clientes/${creditLimit.customer.id}`}>
              <Button variant="outline" className="w-full">
                Ver Ficha del Cliente
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Garantes y Elegibilidad</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Garantes Activos</span>
              <Badge variant="default">{creditLimit.guarantors_active_count}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Garantes Requeridos</span>
              <Badge variant="outline">{creditLimit.guarantors_required}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Elegible para Ampliación</span>
              <Badge variant={creditLimit.eligible_for_extension ? 'default' : 'secondary'}>
                {creditLimit.eligible_for_extension ? 'Sí' : 'No'}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {auditHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Historial de Cambios</CardTitle>
            <CardDescription>Registro de todas las modificaciones</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {auditHistory.map((log: any) => (
                <div key={log.id} className="border-l-2 border-muted pl-4 pb-4">
                  <p className="font-medium text-sm">{log.action.charAt(0).toUpperCase() + log.action.slice(1)}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(log.created_at).toLocaleDateString('es-AR', {
                      year: 'numeric',
                      month: 'numeric',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {loans.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Préstamos Asociados
            </CardTitle>
            <CardDescription>Préstamos activos que consumen este límite de crédito</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {loans.map((loan: any) => (
                <Link key={loan.id} to={`/prestamos/${loan.id}`}>
                  <div className="border rounded-lg p-3 hover:bg-muted transition-colors cursor-pointer">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{loan.loan_number}</p>
                        <p className="text-xs text-muted-foreground">{new Date(loan.created_at).toLocaleDateString('es-AR')}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">${loan.total_amount.toLocaleString('es-AR')}</p>
                        <Badge variant={loan.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                          {loan.status === 'active' ? 'Activo' : 'Aprobado'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
