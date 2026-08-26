import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Eye } from 'lucide-react'

const getStatusColor = (status: string) => {
  switch (status) {
    case 'pending':
      return 'bg-yellow-100 text-yellow-800'
    case 'approved':
      return 'bg-blue-100 text-blue-800'
    case 'active':
      return 'bg-green-100 text-green-800'
    case 'completed':
      return 'bg-gray-100 text-gray-800'
    case 'rejected':
      return 'bg-red-100 text-red-800'
    case 'defaulted':
      return 'bg-red-100 text-red-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'pending':
      return 'Pendiente'
    case 'approved':
      return 'Aprobado'
    case 'active':
      return 'Activo'
    case 'completed':
      return 'Completado'
    case 'rejected':
      return 'Rechazado'
    case 'defaulted':
      return 'En mora'
    default:
      return status
  }
}

export default function LoansPage() {
  const [loans, setLoans] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('loans')
        .select(`
          id, loan_number, customer_id, principal_amount, interest_rate, total_amount, term_months,
          installment_amount, status, created_at,
          customer:customer_id ( id, customer_code, first_name, last_name, document_number )
        `)
        .order('created_at', { ascending: false })
        .limit(100)

      setLoans(data || [])
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div className="space-y-6">
      <PageHeader title="Préstamos" description="Gestión y seguimiento de préstamos otorgados">
        <Link to="/prestamos/simulacion">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Préstamo
          </Button>
        </Link>
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle>Listado de Préstamos</CardTitle>
          <CardDescription>Total: {loans.length} préstamos registrados</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Cargando...</div>
          ) : loans.length > 0 ? (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>CUIT</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead className="text-right">Cuotas</TableHead>
                    <TableHead className="text-right">Tasa</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loans.map((loan: any) => (
                    <TableRow key={loan.id}>
                      <TableCell className="font-medium">{loan.loan_number}</TableCell>
                      <TableCell>
                        {loan.customer?.first_name} {loan.customer?.last_name}
                      </TableCell>
                      <TableCell>{loan.customer?.document_number || 'N/A'}</TableCell>
                      <TableCell className="text-right">${(loan.principal_amount || 0).toLocaleString('es-AR')}</TableCell>
                      <TableCell className="text-right">{loan.term_months}</TableCell>
                      <TableCell className="text-right">{((loan.interest_rate || 0) * 100).toFixed(2)}%</TableCell>
                      <TableCell className="text-right font-medium">${(loan.total_amount || 0).toLocaleString('es-AR')}</TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(loan.status)}>{getStatusLabel(loan.status)}</Badge>
                      </TableCell>
                      <TableCell>{new Date(loan.created_at).toLocaleDateString('es-AR')}</TableCell>
                      <TableCell>
                        <Link to={`/prestamos/${loan.id}`}>
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">No hay préstamos registrados</div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
