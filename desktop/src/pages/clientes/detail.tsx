import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CurrencyDisplay } from '@/components/ui/currency-display'
import { StatusBadge } from '@/components/ui/status-badge'
import { GuarantorSection } from '@/components/layout/guarantor-section'
import { CustomerPortalCard } from '@/components/layout/customer-portal-card'
import { Spinner } from '@/components/ui/spinner'
import { Edit, User, Building2, Phone, Mail, MapPin, Briefcase, CreditCard, FileText, Calendar } from 'lucide-react'

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  inactive: 'bg-gray-100 text-gray-800',
  blocked: 'bg-red-100 text-red-800',
  suspended: 'bg-yellow-100 text-yellow-800',
}

const statusLabels: Record<string, string> = {
  active: 'Activo',
  inactive: 'Inactivo',
  blocked: 'Bloqueado (mora)',
  suspended: 'Suspendido',
}

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [customer, setCustomer] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from('customers')
        .select(`
          *,
          credit_limits ( id, approved_limit, committed_limit, available_credit, status, guarantors_active_count, eligible_for_extension ),
          loans!loans_customer_id_fkey ( id, loan_number, principal_amount, total_amount, status, created_at )
        `)
        .eq('id', id)
        .single()

      if (error) console.error(error)
      setCustomer(data)
      setLoading(false)
    }
    load()
  }, [id])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner className="h-6 w-6" />
      </div>
    )
  }

  if (!customer) {
    return <div className="p-6 text-muted-foreground">Cliente no encontrado</div>
  }

  const creditLimit = customer.credit_limits?.[0]
  const loans = customer.loans || []
  const activeLoans = loans.filter((l: any) => l.status === 'active')
  const totalDebt = activeLoans.reduce((sum: number, l: any) => sum + l.total_amount, 0)

  const getDisplayName = () => {
    if (customer.person_type === 'juridica' && customer.razon_social) return customer.razon_social
    return `${customer.first_name} ${customer.last_name}`
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={getDisplayName()} description={`Codigo: ${customer.customer_code}`} backHref="/clientes">
        <div className="flex items-center gap-2">
          <Badge className={statusColors[customer.status] || statusColors.inactive}>
            {statusLabels[customer.status] || customer.status}
          </Badge>
          <Link to={`/clientes/${id}/editar`}>
            <Button>
              <Edit className="mr-2 h-4 w-4" />
              Editar
            </Button>
          </Link>
        </div>
      </PageHeader>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Límite Aprobado</span>
            </div>
            <div className="text-2xl font-bold mt-2">
              {creditLimit ? `$${creditLimit.approved_limit.toLocaleString('es-AR')}` : <span className="text-muted-foreground">Sin límite</span>}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Comprometido</span>
            </div>
            <div className="text-2xl font-bold mt-2">
              {creditLimit ? `$${creditLimit.committed_limit.toLocaleString('es-AR')}` : <span className="text-muted-foreground">-</span>}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-green-600" />
              <span className="text-sm text-muted-foreground">Disponible</span>
            </div>
            <div className="text-2xl font-bold text-green-600 mt-2">
              {creditLimit ? `$${creditLimit.available_credit.toLocaleString('es-AR')}` : <span className="text-muted-foreground">-</span>}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Deuda Total</span>
            </div>
            <div className="text-2xl font-bold mt-2 text-red-600">
              <CurrencyDisplay amount={totalDebt} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {customer.person_type === 'fisica' ? <User className="h-5 w-5" /> : <Building2 className="h-5 w-5" />}
              {customer.person_type === 'fisica' ? 'Datos Personales' : 'Datos de la Empresa'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {customer.person_type === 'fisica' ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Nombre</p>
                    <p className="font-medium">{customer.first_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Apellido</p>
                    <p className="font-medium">{customer.last_name}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Tipo Documento</p>
                    <p className="font-medium">{customer.document_type}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Numero</p>
                    <p className="font-medium">{customer.document_number}</p>
                  </div>
                </div>
                {customer.cuit_cuil && (
                  <div>
                    <p className="text-sm text-muted-foreground">CUIL</p>
                    <p className="font-medium">{customer.cuit_cuil}</p>
                  </div>
                )}
                {customer.birth_date && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Fecha de Nacimiento</p>
                      <p className="font-medium">{new Date(customer.birth_date).toLocaleDateString('es-AR')}</p>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                <div>
                  <p className="text-sm text-muted-foreground">Razon Social</p>
                  <p className="font-medium">{customer.razon_social}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">CUIT</p>
                  <p className="font-medium">{customer.cuit_cuil}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Contacto
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {customer.phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Telefono</p>
                  <p className="font-medium">{customer.phone}</p>
                </div>
              </div>
            )}
            {customer.email && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{customer.email}</p>
                </div>
              </div>
            )}
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground mt-1" />
              <div>
                <p className="text-sm text-muted-foreground">Domicilio</p>
                <p className="font-medium">
                  {customer.address || '-'}
                  {customer.localidad && <>, {customer.localidad}</>}
                  {customer.provincia && <>, {customer.provincia}</>}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {customer.person_type === 'fisica' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="h-5 w-5" />
                Datos Laborales
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {customer.occupation && (
                <div>
                  <p className="text-sm text-muted-foreground">Ocupacion</p>
                  <p className="font-medium">{customer.occupation}</p>
                </div>
              )}
              {customer.employer && (
                <div>
                  <p className="text-sm text-muted-foreground">Empleador</p>
                  <p className="font-medium">{customer.employer}</p>
                </div>
              )}
              {!customer.occupation && !customer.employer && (
                <p className="text-muted-foreground">Sin datos laborales registrados</p>
              )}
            </CardContent>
          </Card>
        )}

        {customer.notes && (
          <Card>
            <CardHeader>
              <CardTitle>Notas</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap">{customer.notes}</p>
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Historial de Prestamos
          </CardTitle>
          <CardDescription>{loans.length} prestamo(s) registrado(s)</CardDescription>
        </CardHeader>
        <CardContent>
          {loans.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Este cliente no tiene prestamos registrados</p>
          ) : (
            <div className="space-y-4">
              {loans.map((loan: any) => (
                <div key={loan.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">{loan.loan_number}</p>
                    <p className="text-sm text-muted-foreground">{new Date(loan.created_at).toLocaleDateString('es-AR')}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">
                      <CurrencyDisplay amount={loan.total_amount} />
                    </p>
                    <StatusBadge status={loan.status} />
                  </div>
                  <Link to={`/prestamos/${loan.id}`}>
                    <Button variant="ghost" size="sm">
                      Ver
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {creditLimit && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Límite de Crédito
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="border-t pt-4 grid gap-4 grid-cols-2">
              <div>
                <p className="text-sm text-muted-foreground">Estado</p>
                <Badge
                  className={
                    creditLimit.status === 'approved'
                      ? 'bg-green-100 text-green-800'
                      : creditLimit.status === 'pending_approval'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-gray-100 text-gray-800'
                  }
                >
                  {creditLimit.status === 'approved' ? 'Aprobado' : creditLimit.status === 'pending_approval' ? 'Pendiente' : creditLimit.status}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Garantes Activos</p>
                <p className="font-medium">{creditLimit.guarantors_active_count}</p>
              </div>
            </div>
            <Link to={`/creditos/${creditLimit.id}`}>
              <Button className="w-full">Ver Detalle Completo</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      <CustomerPortalCard customerName={getDisplayName()} customerCode={customer.customer_code} portalToken={customer.portal_token} />

      <GuarantorSection customerId={id!} isGuarantor={true} />
    </div>
  )
}
