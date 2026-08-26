import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Users } from 'lucide-react'

const getStatusBadge = (status: string) => {
  const colors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-blue-100 text-blue-800',
    active: 'bg-green-100 text-green-800',
    completed: 'bg-gray-100 text-gray-800',
    rejected: 'bg-red-100 text-red-800',
    defaulted: 'bg-red-100 text-red-800',
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

export default function LoanDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [loan, setLoan] = useState<any>(null)
  const [installments, setInstallments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: loanData } = await supabase
        .from('loans')
        .select(`
          *,
          customer:customer_id ( id, customer_code, first_name, last_name, document_number, status ),
          loan_guarantors ( guarantor:guarantor_customer_id ( id, first_name, last_name, customer_code ) )
        `)
        .eq('id', id)
        .single()

      const { data: instData } = await supabase
        .from('installments')
        .select('*')
        .eq('loan_id', id)
        .order('installment_number', { ascending: true })

      setLoan(loanData)
      setInstallments(instData || [])
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

  if (!loan) {
    return <div className="p-6 text-muted-foreground">Préstamo no encontrado</div>
  }

  const totalPaid = installments.reduce((sum, inst) => sum + (inst.paid_amount || 0), 0)
  const remainingBalance = (loan.total_amount || 0) - totalPaid

  return (
    <div className="space-y-6">
      <PageHeader
        title={loan.loan_number}
        description={`Cliente: ${loan.customer?.first_name} ${loan.customer?.last_name}`}
        backHref="/prestamos"
      >
        <Badge className={getStatusBadge(loan.status)}>{loan.status.charAt(0).toUpperCase() + loan.status.slice(1)}</Badge>
      </PageHeader>

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
              <p className="text-sm text-muted-foreground">Cuota</p>
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
              <p className="font-medium">{loan.disbursement_date ? new Date(loan.disbursement_date).toLocaleDateString('es-AR') : 'N/A'}</p>
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
              <Badge key={lg.guarantor.id} variant="secondary">
                {lg.guarantor.first_name} {lg.guarantor.last_name} ({lg.guarantor.customer_code})
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}

      {installments.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Plan de Cuotas</CardTitle>
              <CardDescription>Total de {installments.length} cuotas</CardDescription>
            </div>
            <Link to={`/cobranza?loan_id=${loan.id}`}>
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
                      <TableCell className="text-right">${(inst.principal_amount || 0).toLocaleString('es-AR')}</TableCell>
                      <TableCell className="text-right">${(inst.interest_amount || 0).toLocaleString('es-AR')}</TableCell>
                      <TableCell className="text-right font-medium">${(inst.total_amount || 0).toLocaleString('es-AR')}</TableCell>
                      <TableCell className="text-right">${(inst.paid_amount || 0).toLocaleString('es-AR')}</TableCell>
                      <TableCell className="text-right text-destructive">
                        {inst.penalty_amount > 0 ? `$${inst.penalty_amount.toLocaleString('es-AR')}` : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={inst.status === 'paid' ? 'default' : 'secondary'}>{getInstallmentStatus(inst.status)}</Badge>
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
