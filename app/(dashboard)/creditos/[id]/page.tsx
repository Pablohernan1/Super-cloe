import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Edit, DollarSign, Users, Calendar, User, FileText, TrendingUp } from 'lucide-react'
import Link from 'next/link'
import { CreditLimitActions } from './credit-limit-actions'

interface CreditLimitDetailPageProps {
  params: Promise<{ id: string }>
}

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

export default async function CreditLimitDetailPage({ params }: CreditLimitDetailPageProps) {
  const { id } = await params
  const supabase = await createClient()

  // Get user role for permissions
  const { data: { user: authUser } } = await supabase.auth.getUser()
  let userProfile = null
  
  if (authUser) {
    const { data } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', authUser.id)
      .single()
    userProfile = data
  }

  // Fetch credit limit with customer and audit history
  const { data: creditLimit, error } = await supabase
    .from('credit_limits')
    .select(`
      *,
      customer:customer_id (
        id,
        first_name,
        last_name,
        customer_code,
        cuit_cuil,
        status,
        person_type,
        razon_social
      )
    `)
    .eq('id', id)
    .single()

  if (error || !creditLimit) {
    notFound()
  }

  // Fetch audit history for this credit limit
  const { data: auditHistory } = await supabase
    .from('audit_logs')
    .select(`
      *,
      user:user_id (
        id,
        email
      )
    `)
    .eq('table_name', 'credit_limits')
    .eq('record_id', id)
    .order('created_at', { ascending: false })

  // Fetch loans associated with this credit limit
  const { data: loans } = await supabase
    .from('loans')
    .select('id, loan_number, principal_amount, total_amount, status, disbursement_date, created_at')
    .eq('customer_id', creditLimit.customer_id)
    .in('status', ['active', 'approved'])
    .order('created_at', { ascending: false })

  // Count active guarantors
  const { data: guarantors } = await supabase
    .from('guarantor_relations')
    .select('id')
    .eq('titular_customer_id', creditLimit.customer_id)
    .eq('status', 'active')

  const customerName =
    creditLimit.customer.person_type === 'juridica' && creditLimit.customer.razon_social
      ? creditLimit.customer.razon_social
      : `${creditLimit.customer.first_name} ${creditLimit.customer.last_name}`

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Detalle de Límite de Crédito"
        description={`Cliente: ${customerName}`}
        backHref="/creditos"
      >
        <div className="flex items-center gap-2">
          <Badge className={statusColors[creditLimit.status] || statusColors.pending_approval}>
            {statusLabels[creditLimit.status] || creditLimit.status}
          </Badge>
        </div>
      </PageHeader>

      {/* Action Buttons */}
      {creditLimit.status === 'pending_approval' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-900 mb-3">Acciones disponibles:</p>
          <CreditLimitActions creditLimit={creditLimit} userRole={userProfile?.role || null} />
        </div>
      )}

      {/* Main Info Cards */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Límite Aprobado</span>
            </div>
            <div className="text-2xl font-bold mt-2">
              ${creditLimit.approved_limit.toLocaleString('es-AR')}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Comprometido</span>
            </div>
            <div className="text-2xl font-bold mt-2">
              ${creditLimit.committed_limit.toLocaleString('es-AR')}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-green-600" />
              <span className="text-sm text-muted-foreground">Disponible</span>
            </div>
            <div className="text-2xl font-bold text-green-600 mt-2">
              ${creditLimit.available_credit.toLocaleString('es-AR')}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Details */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Customer Info */}
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
              <span className="text-sm text-muted-foreground">Código</span>
              <p className="font-medium">{creditLimit.customer.customer_code}</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">CUIT/CUIL</span>
              <p className="font-medium">{creditLimit.customer.cuit_cuil}</p>
            </div>
            <Link href={`/clientes/${creditLimit.customer.id}`}>
              <Button variant="outline" className="w-full">
                Ver Ficha del Cliente
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Guarantors & Eligibility */}
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
            {creditLimit.guarantors_active_count < creditLimit.guarantors_required && (
              <p className="text-xs text-orange-600 bg-orange-50 p-2 rounded">
                Faltan {creditLimit.guarantors_required - creditLimit.guarantors_active_count} garante(s) para cumplir requisitos.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Approval Info */}
      <Card>
        <CardHeader>
          <CardTitle>Información de Aprobación</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <div>
              <span className="text-sm text-muted-foreground">Aprobado Por</span>
              <p className="font-medium">{creditLimit.approved_by || 'N/A'}</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Fecha Aprobación</span>
              <p className="font-medium">
                {creditLimit.approved_at
                  ? new Date(creditLimit.approved_at).toLocaleDateString('es-AR')
                  : 'Pendiente'}
              </p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Creado Por</span>
              <p className="font-medium">{creditLimit.created_by || 'Sistema'}</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Fecha Creación</span>
              <p className="font-medium">
                {new Date(creditLimit.created_at).toLocaleDateString('es-AR')}
              </p>
            </div>
          </div>
          {creditLimit.observations && (
            <div>
              <span className="text-sm text-muted-foreground">Observaciones</span>
              <p className="font-medium">{creditLimit.observations}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Audit History */}
      {auditHistory && auditHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Historial de Cambios</CardTitle>
            <CardDescription>Registro de todas las modificaciones</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {auditHistory.map((log: any) => (
                <div key={log.id} className="border-l-2 border-muted pl-4 pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">
                        {log.action.charAt(0).toUpperCase() + log.action.slice(1)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {log.user?.email || 'Sistema'} -
                        {new Date(log.created_at).toLocaleDateString('es-AR', {
                          year: 'numeric',
                          month: 'numeric',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                  {log.changes && Object.keys(log.changes).length > 0 && (
                    <div className="mt-2 text-xs space-y-1">
                      {Object.entries(log.changes).map(([key, value]: [string, any]) => (
                        <p key={key} className="text-muted-foreground">
                          <span className="font-medium">{key}:</span> {JSON.stringify(value)}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Associated Loans */}
      {loans && loans.length > 0 && (
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
                <Link key={loan.id} href={`/prestamos/${loan.id}`}>
                  <div className="border rounded-lg p-3 hover:bg-muted transition-colors cursor-pointer">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{loan.loan_number}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(loan.created_at).toLocaleDateString('es-AR')}
                        </p>
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
