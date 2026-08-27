import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { Search, User, FileText, HandCoins, Bell } from 'lucide-react'

interface QuickSearchResult {
  customer: {
    id: string
    first_name: string
    last_name: string
    razon_social: string | null
    person_type: string
    status: string
  }
  available: number | null
  guarantorsCount: number
  overdueInstallments: number
  nextDueDate: string | null
}

const statusLabels: Record<string, string> = {
  active: 'Activo',
  inactive: 'Inactivo',
  blocked: 'Bloqueado (mora)',
  suspended: 'Suspendido',
}

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  inactive: 'bg-gray-100 text-gray-800',
  blocked: 'bg-red-100 text-red-800',
  suspended: 'bg-yellow-100 text-yellow-800',
}

export function QuickSearch() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<QuickSearchResult | null>(null)

  const handleSearch = async () => {
    if (!query.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const cleaned = query.trim()
      const { data: customer } = await supabase
        .from('customers')
        .select('id, first_name, last_name, razon_social, person_type, status')
        .or(`document_number.eq.${cleaned},cuit_cuil.eq.${cleaned},customer_code.eq.${cleaned}`)
        .limit(1)
        .maybeSingle()

      if (!customer) {
        setError('No se encontró ningún cliente con ese CUIT/CUIL/código.')
        return
      }

      const [{ data: creditLimit }, { data: guarantors }, { count: overdueCount }, { data: overdue }] = await Promise.all([
        supabase.from('credit_limits').select('available_credit').eq('customer_id', customer.id).maybeSingle(),
        supabase.from('guarantor_relations').select('id').eq('titular_customer_id', customer.id).eq('status', 'active'),
        supabase
          .from('installments')
          .select('id, loan:loan_id!inner(customer_id)', { count: 'exact', head: true })
          .eq('loan.customer_id', customer.id)
          .eq('status', 'overdue'),
        supabase
          .from('installments')
          .select('due_date, loan:loan_id!inner(customer_id)')
          .eq('loan.customer_id', customer.id)
          .in('status', ['pending', 'partial', 'overdue'])
          .order('due_date', { ascending: true })
          .limit(1),
      ])

      setResult({
        customer,
        available: creditLimit?.available_credit ?? null,
        guarantorsCount: guarantors?.length || 0,
        overdueInstallments: overdueCount || 0,
        nextDueDate: overdue?.[0]?.due_date || null,
      })
    } finally {
      setLoading(false)
    }
  }

  const displayName = (c: QuickSearchResult['customer']) =>
    c.person_type === 'juridica' && c.razon_social ? c.razon_social : `${c.first_name} ${c.last_name}`

  return (
    <Card className="border-primary/20">
      <CardContent className="pt-6 space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por CUIT/CUIL o código de cliente..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="pl-10 text-base h-12"
            />
          </div>
          <Button onClick={handleSearch} disabled={loading || !query.trim()} size="lg">
            {loading ? <Spinner className="h-4 w-4" /> : 'Buscar'}
          </Button>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {result && (
          <div className="rounded-lg border p-4 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-lg font-bold">{displayName(result.customer)}</p>
              <Badge className={statusColors[result.customer.status] || statusColors.inactive}>
                {statusLabels[result.customer.status] || result.customer.status}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">Disponible</p>
                <p className="font-semibold text-green-700">
                  {result.available !== null ? `$${result.available.toLocaleString('es-AR')}` : 'Sin límite'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Mora</p>
                <p className={`font-semibold ${result.overdueInstallments > 0 ? 'text-destructive' : ''}`}>
                  {result.overdueInstallments > 0 ? `${result.overdueInstallments} cuota(s)` : 'Sin mora'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Garantes</p>
                <p className="font-semibold">{result.guarantorsCount} válido(s)</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Próximo vencimiento</p>
                <p className="font-semibold">
                  {result.nextDueDate ? new Date(result.nextDueDate).toLocaleDateString('es-AR') : '-'}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <Link to={`/clientes/${result.customer.id}`}>
                <Button variant="outline" size="sm">
                  <User className="mr-2 h-4 w-4" />
                  Cuenta
                </Button>
              </Link>
              <Link to={`/prestamos/simulacion?customer_id=${result.customer.id}`}>
                <Button variant="outline" size="sm">
                  <FileText className="mr-2 h-4 w-4" />
                  Nuevo préstamo
                </Button>
              </Link>
              <Link to={`/cobranza?customer_id=${result.customer.id}`}>
                <Button variant="outline" size="sm">
                  <HandCoins className="mr-2 h-4 w-4" />
                  Registrar pago
                </Button>
              </Link>
              <Link to="/alertas">
                <Button variant="outline" size="sm">
                  <Bell className="mr-2 h-4 w-4" />
                  Ver alertas
                </Button>
              </Link>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
