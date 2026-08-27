import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { ArrowLeft, DollarSign, Calendar, Users } from 'lucide-react'
import Link from 'next/link'

export const metadata = {
  title: 'Detalle de Préstamo',
}

export default async function LoanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  // Fetch loan with details
  const { data: loan } = await supabase
    .from('loans')
    .select(`
      *,
      customer:customer_id (
        id,
        customer_code,
        first_name,
        last_name,
        document_number,
        status
      ),
      loan_guarantors (
        guarantor:guarantor_customer_id ( id, first_name, last_name, customer_code )
      )
    `)
    .eq('id', id)
    .single()

  if (!loan) {
    notFound()
  }

  // Fetch installments
  const { data: installments } = await supabase
    .from('installments')
    .select('*')
    .eq('loan_id', id)
    .order('installment_number', { ascending: true })

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-blue-100 text-blue-800',
      active: 'bg-green-100 text-green-800',
      completed: 'bg-gray-100 text-gray-800',
      rejected: 'bg-red-100 text-red-800',
    }
    return colors[status] || 'bg-gray-100'
  }

  const getInstallmentStatus = (status: string) => {
    const labels: Record<string, string> = {
      pending: 'Pendiente',
      paid: 'Pagada',
      partial: 'Parcial',
      overdue: 'Vencida',
    }
    return labels[status] || status
  }

  const totalPaid = installments?.reduce((sum, inst) => sum + (inst.paid_amount || 0), 0) || 0
  const remainingBalance = (loan.total_amount || 0) - totalPaid

  return (
    <div className="space-y-6">
      <PageHeader
        title={loan.loan_number}
        description={`Cliente: ${loan.customer?.first_name} ${loan.customer?.last_name}`}
        backHref="/prestamos"
      >
        <Badge className={getStatusBadge(loan.status)}>
          {loan.status.charAt(0).toUpperCase() + loan.status.slice(1)}
        </Badge>
      </PageHeader>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Monto Principal</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${(loan.principal_amount || 0).toLocaleString('es-AR')}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Monto Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${(loan.total_amount || 0).toLocaleString('es-AR')}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pagado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">${totalPaid.toLocaleString('es-AR')}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Saldo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">${remainingBalance.toLocaleString('es-AR')}</div>
          </CardContent>
        </Card>
      </div>

      {/* Loan Details */}
      <Card>
        <CardHeader>
          <CardTitle>Detalles del Préstamo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 grid-cols-2 md:grid-cols-3">
            <div>
              <p className="text-sm text-muted-foreground">Cuotas</p>
              <p className="font-medium">{loan.term_months}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Cuota Mensual</p>
              <p className="font-medium">${(loan.installment_amount || 0).toLocaleString('es-AR')}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Tasa de Interés</p>
              <p className="font-medium">{((loan.interest_rate || 0) * 100).toFixed(2)}%</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Fecha Creación</p>
              <p className="font-medium">{new Date(loan.created_at).toLocaleDateString('es-AR')}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Fecha Desembolso</p>
              <p className="font-medium">
                {loan.disbursement_date ? new Date(loan.disbursement_date).toLocaleDateString('es-AR') : 'N/A'}
              </p>
            </div>
            {loan.purpose && (
              <div>
                <p className="text-sm text-muted-foreground">Propósito</p>
                <p className="font-medium">{loan.purpose}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Garantes */}
      {loan.loan_guarantors && loan.loan_guarantors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Garantes
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            {loan.loan_guarantors.map((lg: any) => (
              <Link key={lg.guarantor.id} href={`/clientes/${lg.guarantor.id}`}>
                <Badge variant="secondary" className="cursor-pointer hover:bg-secondary/70">
                  {lg.guarantor.first_name} {lg.guarantor.last_name} ({lg.guarantor.customer_code})
                </Badge>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Installments Table */}
      {installments && installments.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Plan de Cuotas</CardTitle>
              <CardDescription>Total de {installments.length} cuotas</CardDescription>
            </div>
            <Link href={`/cobranza?loan_id=${loan.id}`}>
              <Button>Registrar pago</Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Vencimiento</TableHead>
                    <TableHead className="text-right">Principal</TableHead>
                    <TableHead className="text-right">Interés</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Pagado</TableHead>
                    <TableHead className="text-right">Interés mora</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {installments.map((inst: any) => (
                    <TableRow key={inst.id}>
                      <TableCell className="font-medium">{inst.installment_number}</TableCell>
                      <TableCell>{new Date(inst.due_date).toLocaleDateString('es-AR')}</TableCell>
                      <TableCell className="text-right">
                        ${(inst.principal_amount || 0).toLocaleString('es-AR')}
                      </TableCell>
                      <TableCell className="text-right">
                        ${(inst.interest_amount || 0).toLocaleString('es-AR')}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        ${(inst.total_amount || 0).toLocaleString('es-AR')}
                      </TableCell>
                      <TableCell className="text-right">
                        ${(inst.paid_amount || 0).toLocaleString('es-AR')}
                      </TableCell>
                      <TableCell className="text-right text-destructive">
                        {inst.penalty_amount > 0 ? `$${inst.penalty_amount.toLocaleString('es-AR')}` : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={inst.status === 'paid' ? 'default' : 'secondary'}>
                          {getInstallmentStatus(inst.status)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
