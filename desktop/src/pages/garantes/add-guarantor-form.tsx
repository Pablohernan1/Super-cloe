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

export function AddGuarantorForm() {
  const navigate = useNavigate()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [titular, setTitular] = useState<Customer | null>(null)
  const [guarantor, setGuarantor] = useState<Customer | null>(null)
  const [titularSearch, setTitularSearch] = useState('')
  const [guarantorSearch, setGuarantorSearch] = useState('')
  const [observations, setObservations] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Load all active customers on mount
  useEffect(() => {
    const loadCustomers = async () => {
      try {
        const { data } = await supabase
          .from('customers')
          .select('id, first_name, last_name, customer_code, cuit_cuil, status')
          .eq('status', 'active')
          .order('first_name', { ascending: true })

        if (data) {
          setCustomers(data)
        }
      } catch (err) {
        console.error('Error loading customers:', err)
      } finally {
        setIsLoading(false)
      }
    }

    loadCustomers()
  }, [supabase])

  // Filter customers based on search
  const filteredTitular = customers.filter(c =>
    `${c.first_name} ${c.last_name} ${c.customer_code} ${c.cuit_cuil}`.toLowerCase().includes(titularSearch.toLowerCase())
  )

  const filteredGuarantor = customers.filter(c =>
    `${c.first_name} ${c.last_name} ${c.customer_code} ${c.cuit_cuil}`.toLowerCase().includes(guarantorSearch.toLowerCase())
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    
    if (!titular || !guarantor) {
      setError('Debe seleccionar titular y garante')
      return
    }

    if (titular.id === guarantor.id) {
      setError('El titular y garante no pueden ser la misma persona')
      return
    }

    setIsSubmitting(true)

    const { error: insertError } = await supabase
      .from('guarantor_relations')
      .insert({
        titular_customer_id: titular.id,
        guarantor_customer_id: guarantor.id,
        observations,
        status: 'active',
      })

    if (insertError) {
      if (insertError.message.includes('duplicate')) {
        setError('Esta relación de garantía ya existe')
      } else {
        setError(insertError.message)
      }
      setIsSubmitting(false)
      return
    }

    setSuccess(true)
    setTitular(null)
    setGuarantor(null)
    setObservations('')
    setTitularSearch('')
    setGuarantorSearch('')
    
    setTimeout(() => {
      navigate('/garantes')
    }, 1500)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner className="h-6 w-6" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Agregar Garante"
        description="Crear una nueva relación de garantía"
        backHref="/garantes"
      />

      <Card>
        <CardHeader>
          <CardTitle>Nueva Relación de Garantía</CardTitle>
          <CardDescription>
            Asocie un cliente como garante de otro cliente
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="mb-6 bg-green-50 text-green-900 border-green-200">
              <AlertDescription>Relación de garantía creada exitosamente</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Titular Selection */}
            <FieldGroup>
              <FieldLabel>Cliente Titular</FieldLabel>
              <Input
                placeholder="Filtrar cliente titular..."
                value={titularSearch}
                onChange={(e) => setTitularSearch(e.target.value)}
                className="mb-2"
              />
              <Select value={titular?.id || ''} onValueChange={(customerId) => {
                const selected = customers.find(c => c.id === customerId)
                setTitular(selected || null)
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar cliente titular..." />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {filteredTitular.length > 0 ? (
                    filteredTitular.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        <div>
                          <span className="font-medium">{c.first_name} {c.last_name}</span>
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
              {titular && (
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="text-sm font-medium text-blue-900">{titular.first_name} {titular.last_name}</div>
                  <div className="text-xs text-blue-700">{titular.customer_code} - {titular.cuit_cuil}</div>
                </div>
              )}
            </FieldGroup>

            {/* Guarantor Selection */}
            <FieldGroup>
              <FieldLabel>Cliente Garante</FieldLabel>
              <Input
                placeholder="Filtrar cliente garante..."
                value={guarantorSearch}
                onChange={(e) => setGuarantorSearch(e.target.value)}
                className="mb-2"
              />
              <Select value={guarantor?.id || ''} onValueChange={(customerId) => {
                const selected = customers.find(c => c.id === customerId)
                setGuarantor(selected || null)
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar cliente garante..." />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {filteredGuarantor.length > 0 ? (
                    filteredGuarantor.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        <div>
                          <span className="font-medium">{c.first_name} {c.last_name}</span>
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
              {guarantor && (
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="text-sm font-medium text-blue-900">{guarantor.first_name} {guarantor.last_name}</div>
                  <div className="text-xs text-blue-700">{guarantor.customer_code} - {guarantor.cuit_cuil}</div>
                </div>
              )}
            </FieldGroup>

            {/* Observations */}
            <FieldGroup>
              <FieldLabel>Observaciones (Opcional)</FieldLabel>
              <textarea
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                placeholder="Notas sobre la relación de garantía..."
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                disabled={isSubmitting}
              />
            </FieldGroup>

            <Button type="submit" disabled={isSubmitting || !titular || !guarantor}>
              {isSubmitting && <Spinner className="mr-2 h-4 w-4" />}
              Crear Relación de Garantía
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
