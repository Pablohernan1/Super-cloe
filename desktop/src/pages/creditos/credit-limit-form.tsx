import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Spinner } from '@/components/ui/spinner'
import { AlertCircle } from 'lucide-react'

interface Customer {
  id: string
  first_name: string
  last_name: string
  customer_code: string
  cuit_cuil: string
  status: string
}

export function CreditLimitForm() {
  const navigate = useNavigate()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [customerSearch, setCustomerSearch] = useState('')
  const [approvedLimit, setApprovedLimit] = useState('')
  const [observations, setObservations] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadCustomers = async () => {
      try {
        const { data } = await supabase
          .from('customers')
          .select('id, first_name, last_name, customer_code, cuit_cuil, status')
          .eq('status', 'active')
          .order('first_name', { ascending: true })

        if (data) setCustomers(data)
      } catch (err) {
        console.error('Error loading customers:', err)
      } finally {
        setIsLoading(false)
      }
    }

    loadCustomers()
  }, [])

  const filteredCustomers = customers.filter((c) =>
    `${c.first_name} ${c.last_name} ${c.customer_code} ${c.cuit_cuil}`.toLowerCase().includes(customerSearch.toLowerCase())
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!customer || !approvedLimit) {
      setError('Cliente y límite aprobado son requeridos')
      return
    }

    setIsSubmitting(true)

    try {
      const { data: existing } = await supabase
        .from('credit_limits')
        .select('id')
        .eq('customer_id', customer.id)
        .single()

      if (existing) {
        throw new Error('Este cliente ya tiene un límite de crédito')
      }

      const { data: guarantors } = await supabase
        .from('guarantor_relations')
        .select('id')
        .eq('titular_customer_id', customer.id)
        .eq('status', 'active')

      const guarantorsCount = guarantors?.length || 0

      const { data: newLimit, error: insertError } = await supabase
        .from('credit_limits')
        .insert({
          customer_id: customer.id,
          approved_limit: parseFloat(approvedLimit),
          observations,
          guarantors_required: guarantorsCount >= 2 ? 2 : 1,
          guarantors_active_count: guarantorsCount,
          eligible_for_extension: guarantorsCount >= 2,
        })
        .select()
        .single()

      if (insertError) throw insertError

      navigate(`/creditos/${newLimit.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear límite de crédito')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner className="h-6 w-6" />
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl">
      <PageHeader title="Nuevo Límite de Crédito" />

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Datos del Cliente</CardTitle>
          <CardDescription>Selecciona el cliente de la lista o busca por nombre, código o CUIT</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <FieldGroup>
            <FieldLabel>Cliente</FieldLabel>
            <Input
              placeholder="Filtrar cliente..."
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              className="mb-2"
            />
            <Select
              value={customer?.id || ''}
              onValueChange={(customerId) => {
                const selected = customers.find((c) => c.id === customerId)
                setCustomer(selected || null)
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar cliente..." />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                {filteredCustomers.length > 0 ? (
                  filteredCustomers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <div>
                        <span className="font-medium">
                          {c.first_name} {c.last_name}
                        </span>
                        <span className="text-muted-foreground ml-2 text-sm">({c.customer_code})</span>
                      </div>
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="no-results" disabled>
                    No se encontraron clientes
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
            {customer && (
              <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="text-sm font-medium text-blue-900">
                  {customer.first_name} {customer.last_name}
                </div>
                <div className="text-xs text-blue-700">
                  {customer.customer_code} - {customer.cuit_cuil}
                </div>
              </div>
            )}
          </FieldGroup>

          <FieldGroup>
            <FieldLabel>Límite Aprobado ($)</FieldLabel>
            <Input
              type="number"
              placeholder="0.00"
              value={approvedLimit}
              onChange={(e) => setApprovedLimit(e.target.value)}
              step="0.01"
              required
            />
          </FieldGroup>

          <FieldGroup>
            <FieldLabel>Observaciones (Opcional)</FieldLabel>
            <textarea
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              placeholder="Notas sobre el límite de crédito..."
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
            />
          </FieldGroup>

          <div className="flex gap-4">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Spinner className="mr-2 h-4 w-4" />}
              Guardar Límite
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate(-1)}>
              Cancelar
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  )
}
