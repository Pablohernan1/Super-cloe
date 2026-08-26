import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CurrencyDisplay } from '@/components/ui/currency-display'
import { StatusBadge } from '@/components/ui/status-badge'
import { GuarantorSection } from '@/components/layout/guarantor-section'
import Link from 'next/link'
import { Edit, User, Building2, Phone, Mail, MapPin, Briefcase, CreditCard, FileText, Calendar } from 'lucide-react'

interface CustomerDetailPageProps {
  params: Promise<{ id: string }>
}

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  inactive: 'bg-gray-100 text-gray-800',
  blocked: 'bg-yellow-100 text-yellow-800',
  defaulted: 'bg-red-100 text-red-800',
}

const statusLabels: Record<string, string> = {
  active: 'Activo',
  inactive: 'Inactivo',
  blocked: 'Bloqueado',
  defaulted: 'En Mora',
}

export default async function CustomerDetailPage({ params }: CustomerDetailPageProps) {
  const { id } = await params
  const supabase = await createClient()

  // Fetch customer with credit limits and loans
  const { data: customer, error } = await supabase
    .from('customers')
    .select(`
      *,
      credit_limits (
        id,
        approved_limit,
        committed_limit,
        available_credit,
        status,
        guarantors_active_count,
        eligible_for_extension
      ),
      loans (
        id,
        loan_number,
        principal_amount,
        total_amount,
        status,
        created_at
      )
    `)
    .eq('id', id)
    .single()

  if (error || !customer) {
    console.log('[v0] Customer not found:', { error, id })
    notFound()
  }

  console.log('[v0] Customer loaded:', {
    customer_id: customer.id,
    customer_code: customer.customer_code,
    credit_limits_count: customer.credit_limits?.length || 0,
    credit_limits_data: customer.credit_limits
  })

  const creditLimit = customer.credit_limits?.[0]
  const loans = customer.loans || []
  const activeLoans = loans.filter((l: { status: string }) => l.status === 'active' || l.status === 'current')
  const totalDebt = activeLoans.reduce((sum: number, l: { total_amount: number }) => sum + l.total_amount, 0)

  const getDisplayName = () => {
    if (customer.person_type === 'juridica' && customer.razon_social) {
      return customer.razon_social
    }
    return `${customer.first_name} ${customer.last_name}`
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={getDisplayName()}
        description={`Codigo: ${customer.customer_code}`}
        backHref="/clientes"
      >
        <div className="flex items-center gap-2">
          <Badge className={statusColors[customer.status] || statusColors.inactive}>
            {statusLabels[customer.status] || customer.status}
          </Badge>
          <Link href={`/clientes/${id}/editar`}>
            <Button>
              <Edit className="mr-2 h-4 w-4" />
              Editar
            </Button>
          </Link>
        </div>
      </PageHeader>

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Límite Aprobado</span>
            </div>
            <div className="text-2xl font-bold mt-2">
              {creditLimit ? (
                `$${creditLimit.approved_limit.toLocaleString('es-AR')}`
              ) : (
                <span className="text-muted-foreground">Sin límite</span>
              )}
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
              {creditLimit ? (
                `$${creditLimit.committed_limit.toLocaleString('es-AR')}`
              ) : (
                <span className="text-muted-foreground">-</span>
              )}
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
              {creditLimit ? (
                `$${creditLimit.available_credit.toLocaleString('es-AR')}`
              ) : (
                <span className="text-muted-foreground">-</span>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Prestamos Activos</span>
            </div>
            <div className="text-2xl font-bold mt-2">{activeLoans.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Deuda Total</span>
            </div>
            <div className="text-2xl font-bold mt-2 text-red-600">
              <CurrencyDisplay amount={totalDebt} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Datos Personales / Empresariales */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {customer.person_type === 'fisica' ? (
                <User className="h-5 w-5" />
              ) : (
                <Building2 className="h-5 w-5" />
              )}
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
                      <p className="font-medium">
                        {new Date(customer.birth_date).toLocaleDateString('es-AR')}
                      </p>
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
                {customer.fecha_constitucion && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Fecha de Constitucion</p>
                      <p className="font-medium">
                        {new Date(customer.fecha_constitucion).toLocaleDateString('es-AR')}
                      </p>
                    </div>
                  </div>
                )}
                {(customer.first_name || customer.last_name) && (
                  <div>
                    <p className="text-sm text-muted-foreground">Contacto</p>
                    <p className="font-medium">{customer.first_name} {customer.last_name}</p>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Contacto */}
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
                  {customer.city && <>, {customer.city}</>}
                  {customer.provincia && <>, {customer.provincia}</>}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Datos Laborales (solo persona fisica) */}
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
              {customer.monthly_income && (
                <div>
                  <p className="text-sm text-muted-foreground">Ingreso Mensual</p>
                  <p className="font-medium">
                    <CurrencyDisplay amount={customer.monthly_income} />
                  </p>
                </div>
              )}
              {!customer.occupation && !customer.employer && !customer.monthly_income && (
                <p className="text-muted-foreground">Sin datos laborales registrados</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Notas */}
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

      {/* Historial de Prestamos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Historial de Prestamos
          </CardTitle>
          <CardDescription>
            {loans.length} prestamo(s) registrado(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loans.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Este cliente no tiene prestamos registrados
            </p>
          ) : (
            <div className="space-y-4">
              {loans.map((loan: {
                id: string
                loan_number: string
                principal_amount: number
                total_amount: number
                status: string
                created_at: string
              }) => (
                <div
                  key={loan.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div>
                    <p className="font-medium">{loan.loan_number}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(loan.created_at).toLocaleDateString('es-AR')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">
                      <CurrencyDisplay amount={loan.total_amount} />
                    </p>
                    <StatusBadge status={loan.status} />
                  </div>
                  <Link href={`/prestamos/${loan.id}`}>
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

      {/* Credit Limit Section */}
      {creditLimit ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Límite de Crédito
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 grid-cols-3">
              <div>
                <p className="text-sm text-muted-foreground">Aprobado</p>
                <p className="text-xl font-bold">${creditLimit.approved_limit.toLocaleString('es-AR')}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Comprometido</p>
                <p className="text-xl font-bold">${creditLimit.committed_limit.toLocaleString('es-AR')}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Disponible</p>
                <p className="text-xl font-bold text-green-600">
                  ${creditLimit.available_credit.toLocaleString('es-AR')}
                </p>
              </div>
            </div>

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
                  {creditLimit.status === 'approved'
                    ? 'Aprobado'
                    : creditLimit.status === 'pending_approval'
                    ? 'Pendiente'
                    : creditLimit.status}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Elegible para Ampliación</p>
                <Badge variant={creditLimit.eligible_for_extension ? 'default' : 'secondary'}>
                  {creditLimit.eligible_for_extension ? 'Sí' : 'No'}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Garantes Activos</p>
                <p className="font-medium">{creditLimit.guarantors_active_count}</p>
              </div>
            </div>

            <Link href={`/creditos/${creditLimit.id}`}>
              <Button className="w-full">Ver Detalle Completo</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Límite de Crédito
            </CardTitle>
            <CardDescription>No hay límite de crédito asignado</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Este cliente no tiene un límite de crédito. Puedes crear uno ahora.
            </p>
            <Link href="/creditos/nuevo?customer_id=">
              <Button>Crear Límite de Crédito</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Garantes Section */}
      <GuarantorSection customerId={id} isGuarantor={true} />
    </div>
  )
}
