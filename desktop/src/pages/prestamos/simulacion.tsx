import { useState, useCallback, useRef, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { calculateLoanPayment, type LoanCalculation } from '@/lib/interest-rates'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Spinner } from '@/components/ui/spinner'
import { AlertCircle, CheckCircle, Search, Pencil } from 'lucide-react'
import { FieldGroup, FieldLabel } from '@/components/ui/field'

export default function LoanSimulationPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [customers, setCustomers] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [principalAmount, setPrincipalAmount] = useState('')
  const [termMonths, setTermMonths] = useState('')
  const [purpose, setPurpose] = useState('')

  const [creditLimit, setCreditLimit] = useState<any>(null)
  const [activeGuarantors, setActiveGuarantors] = useState<number>(0)
  const [calculation, setCalculation] = useState<LoanCalculation | null>(null)
  const [isCalculating, setIsCalculating] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(true)

  // Muestra clientes activos apenas se entra a la pantalla, y filtra a
  // medida que se escribe.
  const performSearch = useCallback(async (query: string) => {
    setIsSearching(true)
    try {
      let q = supabase
        .from('customers')
        .select('id, first_name, last_name, cuit_cuil, status, customer_code')
        .eq('status', 'active')

      if (query.length >= 1) {
        q = q.or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,cuit_cuil.ilike.%${query}%,customer_code.ilike.%${query}%`)
      } else {
        q = q.order('first_name', { ascending: true })
      }

      const { data } = await q.limit(20)
      setCustomers(data || [])
    } finally {
      setIsSearching(false)
    }
  }, [])

  const handleSearchChange = useCallback(
    (query: string) => {
      setSearchTerm(query)
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = setTimeout(() => performSearch(query), 200)
    },
    [performSearch]
  )

  useEffect(() => {
    performSearch('')
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Si viene con ?customer_id=... (ej. desde el acceso rápido del dashboard)
  useEffect(() => {
    const customerId = searchParams.get('customer_id')
    if (!customerId) return
    const load = async () => {
      const { data } = await supabase
        .from('customers')
        .select('id, first_name, last_name, cuit_cuil, status, customer_code')
        .eq('id', customerId)
        .maybeSingle()
      if (data) setSelectedCustomer(data)
    }
    load()
  }, [searchParams])

  useEffect(() => {
    const loadCreditContext = async () => {
      if (!selectedCustomer) {
        setCreditLimit(null)
        setActiveGuarantors(0)
        return
      }
      const [{ data: cl }, { data: guarantors }] = await Promise.all([
        supabase.from('credit_limits').select('*').eq('customer_id', selectedCustomer.id).single(),
        supabase
          .from('guarantor_relations')
          .select('id, guarantor:guarantor_customer_id(status)')
          .eq('titular_customer_id', selectedCustomer.id)
          .eq('status', 'active'),
      ])
      setCreditLimit(cl)
      setActiveGuarantors((guarantors || []).filter((g: any) => g.guarantor?.status === 'active').length)
    }
    loadCreditContext()
  }, [selectedCustomer])

  const handleCalculate = useCallback(async () => {
    if (!principalAmount || !termMonths) return
    setIsCalculating(true)
    setError(null)
    try {
      const calc = await calculateLoanPayment(parseFloat(principalAmount), parseInt(termMonths, 10))
      setCalculation(calc)
      setEditing(false)
    } finally {
      setIsCalculating(false)
    }
  }, [principalAmount, termMonths])

  const handleCreateLoan = useCallback(async () => {
    if (!selectedCustomer || !calculation) return
    setIsCreating(true)
    setError(null)
    try {
      const { data: guarantors } = await supabase
        .from('guarantor_relations')
        .select('guarantor_customer_id, guarantor:guarantor_customer_id(status)')
        .eq('titular_customer_id', selectedCustomer.id)
        .eq('status', 'active')

      const guarantorIds = (guarantors || [])
        .filter((g: any) => g.guarantor?.status === 'active')
        .map((g: any) => g.guarantor_customer_id)

      const { data, error: rpcError } = await supabase.rpc('create_loan', {
        p_customer_id: selectedCustomer.id,
        p_principal_amount: parseFloat(principalAmount),
        p_term_months: parseInt(termMonths, 10),
        p_guarantor_ids: guarantorIds,
        p_purpose: purpose || null,
      })

      if (rpcError) {
        setError(rpcError.message)
        return
      }

      navigate(`/prestamos/${data.loan.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear el préstamo')
    } finally {
      setIsCreating(false)
    }
  }, [selectedCustomer, calculation, principalAmount, termMonths, purpose, navigate])

  const handleEdit = () => {
    setEditing(true)
    setCalculation(null)
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Simulador de Préstamos" description="Calcula y crea nuevos préstamos" backHref="/prestamos" />

      {editing ? (
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>1. Seleccionar Cliente</CardTitle>
              <CardDescription>Busca el cliente para otorgar el préstamo</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Label className="text-sm mb-2 block">Buscar Cliente</Label>
                <Search className="absolute left-3 top-[34px] h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Escribe nombre o CUIT del cliente..."
                  value={searchTerm}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-9"
                />
                {isSearching && <Spinner className="absolute right-3 top-8 h-4 w-4" />}
              </div>

              {customers.length > 0 && (
                <div className="border rounded-lg max-h-72 overflow-y-auto">
                  {customers.map((customer) => (
                    <button
                      key={customer.id}
                      onClick={() => {
                        setSelectedCustomer(customer)
                        setSearchTerm('')
                        setCustomers([])
                        setCalculation(null)
                      }}
                      className="w-full text-left p-3 hover:bg-muted border-b last:border-b-0 transition-colors"
                    >
                      <p className="font-medium">
                        {customer.first_name} {customer.last_name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {customer.customer_code} • {customer.cuit_cuil}
                      </p>
                    </button>
                  ))}
                </div>
              )}

              {selectedCustomer && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>
                      {selectedCustomer.first_name} {selectedCustomer.last_name}
                    </strong>{' '}
                    seleccionado
                  </AlertDescription>
                </Alert>
              )}

              {selectedCustomer && (
                <div className="grid gap-3 md:grid-cols-2 text-sm">
                  <div className="border rounded-lg p-3">
                    <p className="text-muted-foreground">Disponible</p>
                    <p className="font-bold text-green-600">
                      {creditLimit ? `$${creditLimit.available_credit.toLocaleString('es-AR')}` : 'Sin límite'}
                    </p>
                  </div>
                  <div className="border rounded-lg p-3">
                    <p className="text-muted-foreground">Garantes activos</p>
                    <p className="font-bold">{activeGuarantors}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>2. Parámetros del Préstamo</CardTitle>
              <CardDescription>Ingresa el monto y plazo</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FieldGroup>
                <FieldLabel>Capital Solicitado</FieldLabel>
                <Input
                  type="number"
                  placeholder="100000"
                  value={principalAmount}
                  onChange={(e) => setPrincipalAmount(e.target.value)}
                  disabled={!selectedCustomer}
                />
              </FieldGroup>

              <FieldGroup>
                <FieldLabel>Cuotas (1 a 3)</FieldLabel>
                <Input
                  type="number"
                  placeholder="3"
                  value={termMonths}
                  onChange={(e) => setTermMonths(e.target.value)}
                  disabled={!selectedCustomer}
                  min="1"
                  max="3"
                />
              </FieldGroup>

              <FieldGroup>
                <FieldLabel>Propósito (opcional)</FieldLabel>
                <Input
                  placeholder="Ej: Compra de electrodomésticos"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  disabled={!selectedCustomer}
                />
              </FieldGroup>

              <Button onClick={handleCalculate} disabled={!selectedCustomer || !principalAmount || !termMonths || isCalculating} className="w-full">
                {isCalculating ? 'Calculando...' : 'Simular'}
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardContent className="flex items-center justify-between pt-6">
            <div>
              <p className="font-medium">
                {selectedCustomer?.first_name} {selectedCustomer?.last_name}
              </p>
              <p className="text-sm text-muted-foreground">
                ${parseFloat(principalAmount).toLocaleString('es-AR')} · {termMonths} cuota(s)
                {purpose ? ` · ${purpose}` : ''}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={handleEdit}>
              <Pencil className="mr-2 h-4 w-4" />
              Editar
            </Button>
          </CardContent>
        </Card>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {calculation && (
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Resultado</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4">
                <div className="border rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">Capital</p>
                  <p className="text-2xl font-bold">${calculation.principalAmount.toLocaleString('es-AR')}</p>
                </div>
                <div className="border rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">Interés Total</p>
                  <p className="text-2xl font-bold">${calculation.totalInterest.toLocaleString('es-AR')}</p>
                </div>
                <div className="border rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">Total a Cobrar</p>
                  <p className="text-2xl font-bold">${calculation.totalAmount.toLocaleString('es-AR')}</p>
                </div>
                <div className="border rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">Tasa</p>
                  <p className="text-2xl font-bold">{(calculation.monthlyRate * 100).toFixed(0)}%</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Button onClick={handleCreateLoan} disabled={isCreating} size="lg" className="w-full">
            {isCreating ? 'Confirmando...' : 'Confirmar Préstamo'}
          </Button>
        </div>
      )}
    </div>
  )
}
