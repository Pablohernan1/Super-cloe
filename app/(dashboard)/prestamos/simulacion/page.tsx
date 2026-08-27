'use client'

import { Suspense, useState, useCallback, useRef, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Spinner } from '@/components/ui/spinner'
import { AlertCircle, CheckCircle, Search, Pencil } from 'lucide-react'
import { FieldGroup, FieldLabel } from '@/components/ui/field'
import { createClient } from '@/lib/supabase/client'

interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  customer?: any
  creditLimit?: any
  activeGuarantors?: number
  calculation?: any
}

function LoanSimulationContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [customers, setCustomers] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [principalAmount, setPrincipalAmount] = useState('')
  const [termMonths, setTermMonths] = useState('')
  const [purpose, setPurpose] = useState('')

  const [validation, setValidation] = useState<ValidationResult | null>(null)
  const [isValidating, setIsValidating] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [editing, setEditing] = useState(true)

  // Muestra clientes activos apenas se entra a la pantalla (no hace falta
  // tipear para ver algo), y filtra a medida que se escribe.
  const performSearch = useCallback(async (query: string) => {
    setIsSearching(true)
    try {
      if (query.length < 1) {
        const supabase = createClient()
        const { data } = await supabase
          .from('customers')
          .select('id, first_name, last_name, customer_code, cuit_cuil, document_number, status')
          .eq('status', 'active')
          .order('first_name', { ascending: true })
          .limit(20)
        setCustomers(data || [])
        return
      }

      const response = await fetch(`/api/clientes/search?search=${encodeURIComponent(query)}&limit=20`)
      if (response.ok) {
        const data = await response.json()
        setCustomers(data.customers || [])
      } else {
        setCustomers([])
      }
    } catch (error) {
      console.error('[v0] Search error:', error)
      setCustomers([])
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

  // Si viene con ?customer_id=... (por ejemplo desde el acceso rápido del
  // dashboard), preselecciona ese cliente.
  useEffect(() => {
    const customerId = searchParams.get('customer_id')
    if (!customerId) return

    const load = async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('customers')
        .select('id, first_name, last_name, customer_code, cuit_cuil, document_number, status')
        .eq('id', customerId)
        .maybeSingle()
      if (data) setSelectedCustomer(data)
    }
    load()
  }, [searchParams])

  const handleValidate = useCallback(async () => {
    if (!selectedCustomer || !principalAmount || !termMonths) {
      alert('Por favor complete todos los campos')
      return
    }

    setIsValidating(true)
    try {
      const response = await fetch(`/api/prestamos/${selectedCustomer.id}/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          principal_amount: parseFloat(principalAmount),
          term_months: parseInt(termMonths),
        }),
      })

      const result = await response.json()
      setValidation(result)
      if (result.isValid) setEditing(false)
    } catch (error) {
      console.error('[v0] Validation error:', error)
      setValidation({ isValid: false, errors: ['Error en validación'], warnings: [] })
    } finally {
      setIsValidating(false)
    }
  }, [selectedCustomer, principalAmount, termMonths])

  const handleCreateLoan = useCallback(async () => {
    if (!validation?.isValid) {
      alert('Por favor valide el préstamo primero')
      return
    }

    setIsCreating(true)
    try {
      const response = await fetch('/api/prestamos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: selectedCustomer.id,
          principal_amount: parseFloat(principalAmount),
          term_months: parseInt(termMonths),
          purpose,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        alert(`Error: ${error.error}`)
        return
      }

      const result = await response.json()
      router.push(`/prestamos/${result.loan.id}`)
    } catch (error) {
      console.error('[v0] Creation error:', error)
      alert('Error al crear el préstamo')
    } finally {
      setIsCreating(false)
    }
  }, [validation, selectedCustomer, principalAmount, termMonths, purpose, router])

  const handleEdit = () => {
    setEditing(true)
    setValidation(null)
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
                <Search className="absolute left-3 top-[34px] h-4 w-4 text-muted-foreground" />
                <div className="text-sm mb-2 font-medium">Buscar Cliente</div>
                <Input
                  placeholder="Escribe nombre o CUIT del cliente..."
                  value={searchTerm}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-9"
                />
                {isSearching && <Spinner className="absolute right-3 top-[42px] h-4 w-4" />}
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
                      }}
                      className="w-full text-left p-3 hover:bg-muted border-b last:border-b-0 transition-colors"
                    >
                      <p className="font-medium">
                        {customer.first_name} {customer.last_name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {customer.customer_code} • {customer.cuit_cuil || customer.document_number}
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>2. Parámetros del Préstamo</CardTitle>
              <CardDescription>Ingresa el monto y plazo</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FieldGroup>
                <FieldLabel>Monto Solicitado</FieldLabel>
                <Input
                  type="number"
                  placeholder="10000"
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
                  placeholder="Ej: Compra de herramientas"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  disabled={!selectedCustomer}
                />
              </FieldGroup>

              <Button
                onClick={handleValidate}
                disabled={!selectedCustomer || !principalAmount || !termMonths || isValidating}
                className="w-full"
              >
                {isValidating ? 'Validando...' : 'Validar Préstamo'}
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

      {validation && (
        <div className="grid gap-6">
          {validation.errors.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Errores de validación:</strong>
                <ul className="mt-2 space-y-1">
                  {validation.errors.map((error, i) => (
                    <li key={i} className="text-sm">
                      • {error}
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {validation.isValid && (
            <>
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  Validación exitosa. El cliente es elegible para este préstamo.
                </AlertDescription>
              </Alert>

              {validation.calculation && (
                <Card>
                  <CardHeader>
                    <CardTitle>Resumen de Cálculo</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="border rounded-lg p-4">
                        <p className="text-sm text-muted-foreground">Monto Principal</p>
                        <p className="text-2xl font-bold">${validation.calculation.principalAmount.toLocaleString('es-AR')}</p>
                      </div>
                      <div className="border rounded-lg p-4">
                        <p className="text-sm text-muted-foreground">Interés Total</p>
                        <p className="text-2xl font-bold">${validation.calculation.totalInterest.toLocaleString('es-AR')}</p>
                      </div>
                      <div className="border rounded-lg p-4">
                        <p className="text-sm text-muted-foreground">Total a Pagar</p>
                        <p className="text-2xl font-bold">${validation.calculation.totalAmount.toLocaleString('es-AR')}</p>
                      </div>
                      <div className="border rounded-lg p-4">
                        <p className="text-sm text-muted-foreground">Valor Cuota</p>
                        <p className="text-2xl font-bold">${validation.calculation.monthlyPayment.toLocaleString('es-AR')}</p>
                      </div>
                      <div className="border rounded-lg p-4">
                        <p className="text-sm text-muted-foreground">Tasa</p>
                        <p className="text-2xl font-bold">{(validation.calculation.monthlyRate * 100).toFixed(0)}%</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {validation.creditLimit && (
                <Card>
                  <CardHeader>
                    <CardTitle>Límite de Crédito del Cliente</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Aprobado</p>
                      <p className="font-medium">${validation.creditLimit.approved_limit.toLocaleString('es-AR')}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Comprometido</p>
                      <p className="font-medium">${validation.creditLimit.committed_limit.toLocaleString('es-AR')}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Disponible</p>
                      <p className="font-bold text-green-600">${validation.creditLimit.available_credit.toLocaleString('es-AR')}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Garantes</p>
                      <p className="font-medium">{validation.activeGuarantors || 0}</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Button onClick={handleCreateLoan} disabled={isCreating} size="lg" className="w-full">
                {isCreating ? 'Creando....' : 'Confirmar Préstamo'}
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default function LoanSimulationPage() {
  return (
    <Suspense fallback={<div className="p-6"><Spinner className="h-6 w-6" /></div>}>
      <LoanSimulationContent />
    </Suspense>
  )
}
