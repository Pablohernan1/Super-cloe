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
import { AlertCircle, UserPlus } from 'lucide-react'

interface Customer {
  id: string
  first_name: string
  last_name: string
  customer_code: string
  cuit_cuil: string
  status: string
}

interface QuickCreateProps {
  label: string
  onCreated: (customer: Customer) => void
}

// Alta mínima de una persona para poder usarla como garante sin pasar por
// el alta completa de cliente.
function QuickCreatePerson({ label, onCreated }: QuickCreateProps) {
  const [open, setOpen] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [documentType, setDocumentType] = useState('DNI')
  const [documentNumber, setDocumentNumber] = useState('')
  const [phone, setPhone] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCreate = async () => {
    setError(null)
    if (!firstName || !lastName || !documentNumber || !phone) {
      setError('Nombre, apellido, documento y teléfono son requeridos')
      return
    }

    setIsSubmitting(true)
    try {
      const { count } = await supabase.from('customers').select('*', { count: 'exact', head: true })
      const customerCode = `PF${String((count || 0) + 1).padStart(5, '0')}`

      const { data, error: insertError } = await supabase
        .from('customers')
        .insert({
          customer_code: customerCode,
          person_type: 'fisica',
          document_type: documentType,
          document_number: documentNumber,
          first_name: firstName,
          last_name: lastName,
          phone,
          status: 'active',
        })
        .select('id, first_name, last_name, customer_code, cuit_cuil, status')
        .single()

      if (insertError) {
        setError(insertError.message.includes('duplicate') ? 'Ya existe un cliente con ese documento' : insertError.message)
        return
      }

      onCreated(data)
      setOpen(false)
      setFirstName('')
      setLastName('')
      setDocumentNumber('')
      setPhone('')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-1 text-sm text-primary hover:underline">
        <UserPlus className="h-3.5 w-3.5" />
        Crear nueva persona como {label.toLowerCase()}
      </button>
    )
  }

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-3">
      <p className="text-sm font-medium">Nueva persona ({label.toLowerCase()})</p>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="grid grid-cols-2 gap-2">
        <Input placeholder="Nombre" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        <Input placeholder="Apellido" value={lastName} onChange={(e) => setLastName(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Select value={documentType} onValueChange={setDocumentType}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="DNI">DNI</SelectItem>
            <SelectItem value="CUIL">CUIL</SelectItem>
            <SelectItem value="Pasaporte">Pasaporte</SelectItem>
          </SelectContent>
        </Select>
        <Input placeholder="Número de documento" value={documentNumber} onChange={(e) => setDocumentNumber(e.target.value)} />
      </div>
      <Input placeholder="Teléfono" value={phone} onChange={(e) => setPhone(e.target.value)} />
      <div className="flex gap-2">
        <Button type="button" size="sm" onClick={handleCreate} disabled={isSubmitting}>
          {isSubmitting && <Spinner className="mr-2 h-4 w-4" />}
          Crear y seleccionar
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancelar
        </Button>
      </div>
    </div>
  )
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

  useEffect(() => {
    loadCustomers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filteredTitular = customers.filter((c) =>
    `${c.first_name} ${c.last_name} ${c.customer_code} ${c.cuit_cuil}`.toLowerCase().includes(titularSearch.toLowerCase())
  )

  const filteredGuarantor = customers.filter((c) =>
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

    const { error: insertError } = await supabase.from('guarantor_relations').insert({
      titular_customer_id: titular.id,
      guarantor_customer_id: guarantor.id,
      observations,
      status: 'active',
    })

    if (insertError) {
      setError(insertError.message.includes('duplicate') ? 'Esta relación de garantía ya existe' : insertError.message)
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
      <PageHeader title="Agregar Garante" description="Crear una nueva relación de garantía" backHref="/garantes" />

      <Card>
        <CardHeader>
          <CardTitle>Nueva Relación de Garantía</CardTitle>
          <CardDescription>Asocie un cliente como garante de otro cliente</CardDescription>
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
            <FieldGroup>
              <FieldLabel>Cliente Titular</FieldLabel>
              <Input
                placeholder="Filtrar cliente titular..."
                value={titularSearch}
                onChange={(e) => setTitularSearch(e.target.value)}
                className="mb-2"
              />
              <Select
                value={titular?.id || ''}
                onValueChange={(customerId) => {
                  const selected = customers.find((c) => c.id === customerId)
                  setTitular(selected || null)
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar cliente titular..." />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {filteredTitular.length > 0 ? (
                    filteredTitular.map((c) => (
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
              {titular && (
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="text-sm font-medium text-blue-900">
                    {titular.first_name} {titular.last_name}
                  </div>
                  <div className="text-xs text-blue-700">
                    {titular.customer_code} - {titular.cuit_cuil}
                  </div>
                </div>
              )}
              <div className="mt-2">
                <QuickCreatePerson
                  label="titular"
                  onCreated={(c) => {
                    setCustomers((prev) => [...prev, c])
                    setTitular(c)
                    setTitularSearch('')
                  }}
                />
              </div>
            </FieldGroup>

            <FieldGroup>
              <FieldLabel>Cliente Garante</FieldLabel>
              <Input
                placeholder="Filtrar cliente garante..."
                value={guarantorSearch}
                onChange={(e) => setGuarantorSearch(e.target.value)}
                className="mb-2"
              />
              <Select
                value={guarantor?.id || ''}
                onValueChange={(customerId) => {
                  const selected = customers.find((c) => c.id === customerId)
                  setGuarantor(selected || null)
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar cliente garante..." />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {filteredGuarantor.length > 0 ? (
                    filteredGuarantor.map((c) => (
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
              {guarantor && (
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="text-sm font-medium text-blue-900">
                    {guarantor.first_name} {guarantor.last_name}
                  </div>
                  <div className="text-xs text-blue-700">
                    {guarantor.customer_code} - {guarantor.cuit_cuil}
                  </div>
                </div>
              )}
              <div className="mt-2">
                <QuickCreatePerson
                  label="garante"
                  onCreated={(c) => {
                    setCustomers((prev) => [...prev, c])
                    setGuarantor(c)
                    setGuarantorSearch('')
                  }}
                />
              </div>
            </FieldGroup>

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
