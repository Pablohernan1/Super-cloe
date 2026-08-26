import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Spinner } from '@/components/ui/spinner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AlertCircle, Save, User, Building2, MapPin, Phone, CreditCard } from 'lucide-react'

type Customer = {
  id?: string
  customer_code?: string
  person_type: 'fisica' | 'juridica'
  document_type: string
  document_number: string
  first_name: string
  last_name: string
  razon_social?: string | null
  cuit_cuil?: string | null
  fecha_constitucion?: string | null
  birth_date?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
  city?: string | null
  localidad?: string | null
  provincia?: string | null
  occupation?: string | null
  employer?: string | null
  monthly_income?: number | null
  notes?: string | null
  status?: string
}

interface CustomerFormProps {
  customer?: Customer
  isEditing?: boolean
}

const provincias = [
  'Buenos Aires',
  'Ciudad Autonoma de Buenos Aires',
  'Catamarca',
  'Chaco',
  'Chubut',
  'Cordoba',
  'Corrientes',
  'Entre Rios',
  'Formosa',
  'Jujuy',
  'La Pampa',
  'La Rioja',
  'Mendoza',
  'Misiones',
  'Neuquen',
  'Rio Negro',
  'Salta',
  'San Juan',
  'San Luis',
  'Santa Cruz',
  'Santa Fe',
  'Santiago del Estero',
  'Tierra del Fuego',
  'Tucuman',
]

export function CustomerForm({ customer, isEditing = false }: CustomerFormProps) {
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState<Customer>({
    person_type: customer?.person_type || 'fisica',
    document_type: customer?.document_type || 'DNI',
    document_number: customer?.document_number || '',
    first_name: customer?.first_name || '',
    last_name: customer?.last_name || '',
    razon_social: customer?.razon_social || '',
    cuit_cuil: customer?.cuit_cuil || '',
    fecha_constitucion: customer?.fecha_constitucion || '',
    birth_date: customer?.birth_date || '',
    phone: customer?.phone || '',
    email: customer?.email || '',
    address: customer?.address || '',
    city: customer?.city || '',
    localidad: customer?.localidad || '',
    provincia: customer?.provincia || '',
    occupation: customer?.occupation || '',
    employer: customer?.employer || '',
    monthly_income: customer?.monthly_income || undefined,
    notes: customer?.notes || '',
    status: customer?.status || 'active',
  })

  const [creditLimit, setCreditLimit] = useState<number | undefined>(undefined)

  const handleChange = (field: keyof Customer, value: string | number | null) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const generateCustomerCode = async () => {
    const prefix = formData.person_type === 'fisica' ? 'PF' : 'PJ'
    
    const { count } = await supabase
      .from('customers')
      .select('*', { count: 'exact', head: true })
    
    const nextNumber = (count || 0) + 1
    return `${prefix}${String(nextNumber).padStart(5, '0')}`
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {

      // Validations
      if (formData.person_type === 'fisica') {
        if (!formData.first_name || !formData.last_name) {
          throw new Error('Nombre y apellido son requeridos para persona fisica')
        }
        if (!formData.document_number) {
          throw new Error('Numero de documento es requerido')
        }
      } else {
        if (!formData.razon_social) {
          throw new Error('Razon social es requerida para persona juridica')
        }
        if (!formData.cuit_cuil) {
          throw new Error('CUIT es requerido para persona juridica')
        }
      }

      let customerData: Partial<Customer> = {
        person_type: formData.person_type,
        document_type: formData.document_type,
        document_number: formData.document_number,
        first_name: formData.first_name,
        last_name: formData.last_name,
        razon_social: formData.razon_social || null,
        cuit_cuil: formData.cuit_cuil || null,
        fecha_constitucion: formData.fecha_constitucion || null,
        birth_date: formData.birth_date || null,
        phone: formData.phone || null,
        email: formData.email || null,
        address: formData.address || null,
        city: formData.city || null,
        localidad: formData.localidad || null,
        provincia: formData.provincia || null,
        occupation: formData.occupation || null,
        employer: formData.employer || null,
        monthly_income: formData.monthly_income || null,
        notes: formData.notes || null,
        status: formData.status || 'active',
      }

      if (isEditing && customer?.id) {
        // Update existing customer
        const { error: updateError } = await supabase
          .from('customers')
          .update(customerData)
          .eq('id', customer.id)

        if (updateError) throw updateError

        // Update credit limit if provided
        if (creditLimit !== undefined) {
          const { error: creditError } = await supabase
            .from('credit_limits')
            .upsert({
              customer_id: customer.id,
              approved_limit: creditLimit,
            }, { onConflict: 'customer_id' })

          if (creditError) throw creditError
        }

        navigate(`/clientes/${customer.id}`)
        
      } else {
        // Create new customer - check for duplicate first
        const { data: existingCustomer } = await supabase
          .from('customers')
          .select('id')
          .eq('document_type', formData.document_type)
          .eq('document_number', formData.document_number)
          .single()

        if (existingCustomer) {
          throw new Error(`Ya existe un cliente con ${formData.document_type} ${formData.document_number}`)
        }

        const customerCode = await generateCustomerCode()
        customerData.customer_code = customerCode

        const { data: newCustomer, error: insertError } = await supabase
          .from('customers')
          .insert(customerData)
          .select()
          .single()

        if (insertError) throw insertError

        // Create credit limit if provided
        if (creditLimit !== undefined && newCustomer) {
          const { error: creditError } = await supabase
            .from('credit_limits')
            .insert({
              customer_id: newCustomer.id,
              approved_limit: creditLimit,
            })

          if (creditError) throw creditError
        }

        navigate(`/clientes/${newCustomer.id}`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar el cliente')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Tipo de Persona */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {formData.person_type === 'fisica' ? (
              <User className="h-5 w-5" />
            ) : (
              <Building2 className="h-5 w-5" />
            )}
            Tipo de Persona
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Button
              type="button"
              variant={formData.person_type === 'fisica' ? 'default' : 'outline'}
              onClick={() => handleChange('person_type', 'fisica')}
              disabled={isEditing}
            >
              <User className="mr-2 h-4 w-4" />
              Persona Fisica
            </Button>
            <Button
              type="button"
              variant={formData.person_type === 'juridica' ? 'default' : 'outline'}
              onClick={() => handleChange('person_type', 'juridica')}
              disabled={isEditing}
            >
              <Building2 className="mr-2 h-4 w-4" />
              Persona Juridica
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Datos Personales / Empresariales */}
      <Card>
        <CardHeader>
          <CardTitle>
            {formData.person_type === 'fisica' ? 'Datos Personales' : 'Datos de la Empresa'}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {formData.person_type === 'fisica' ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="first_name">Nombre *</Label>
                <Input
                  id="first_name"
                  value={formData.first_name}
                  onChange={(e) => handleChange('first_name', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Apellido *</Label>
                <Input
                  id="last_name"
                  value={formData.last_name}
                  onChange={(e) => handleChange('last_name', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="document_type">Tipo Documento</Label>
                <Select
                  value={formData.document_type}
                  onValueChange={(value) => handleChange('document_type', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DNI">DNI</SelectItem>
                    <SelectItem value="CUIL">CUIL</SelectItem>
                    <SelectItem value="Pasaporte">Pasaporte</SelectItem>
                    <SelectItem value="LC">Libreta Civica</SelectItem>
                    <SelectItem value="LE">Libreta de Enrolamiento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="document_number">Numero de Documento *</Label>
                <Input
                  id="document_number"
                  value={formData.document_number}
                  onChange={(e) => handleChange('document_number', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="birth_date">Fecha de Nacimiento</Label>
                <Input
                  id="birth_date"
                  type="date"
                  value={formData.birth_date || ''}
                  onChange={(e) => handleChange('birth_date', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cuit_cuil">CUIL (opcional)</Label>
                <Input
                  id="cuit_cuil"
                  value={formData.cuit_cuil || ''}
                  onChange={(e) => handleChange('cuit_cuil', e.target.value)}
                  placeholder="XX-XXXXXXXX-X"
                />
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="razon_social">Razon Social *</Label>
                <Input
                  id="razon_social"
                  value={formData.razon_social || ''}
                  onChange={(e) => handleChange('razon_social', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cuit_cuil">CUIT *</Label>
                <Input
                  id="cuit_cuil"
                  value={formData.cuit_cuil || ''}
                  onChange={(e) => handleChange('cuit_cuil', e.target.value)}
                  placeholder="XX-XXXXXXXX-X"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fecha_constitucion">Fecha de Constitucion</Label>
                <Input
                  id="fecha_constitucion"
                  type="date"
                  value={formData.fecha_constitucion || ''}
                  onChange={(e) => handleChange('fecha_constitucion', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="first_name">Nombre Contacto</Label>
                <Input
                  id="first_name"
                  value={formData.first_name}
                  onChange={(e) => handleChange('first_name', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Apellido Contacto</Label>
                <Input
                  id="last_name"
                  value={formData.last_name}
                  onChange={(e) => handleChange('last_name', e.target.value)}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Contacto */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Datos de Contacto
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="phone">Telefono</Label>
            <Input
              id="phone"
              type="tel"
              value={formData.phone || ''}
              onChange={(e) => handleChange('phone', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email || ''}
              onChange={(e) => handleChange('email', e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Domicilio */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Domicilio
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="address">Direccion</Label>
            <Input
              id="address"
              value={formData.address || ''}
              onChange={(e) => handleChange('address', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="localidad">Localidad</Label>
            <Input
              id="localidad"
              value={formData.localidad || ''}
              onChange={(e) => handleChange('localidad', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="city">Ciudad</Label>
            <Input
              id="city"
              value={formData.city || ''}
              onChange={(e) => handleChange('city', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="provincia">Provincia</Label>
            <Select
              value={formData.provincia || ''}
              onValueChange={(value) => handleChange('provincia', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar provincia" />
              </SelectTrigger>
              <SelectContent>
                {provincias.map((prov) => (
                  <SelectItem key={prov} value={prov}>
                    {prov}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Datos Laborales (solo persona fisica) */}
      {formData.person_type === 'fisica' && (
        <Card>
          <CardHeader>
            <CardTitle>Datos Laborales</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="occupation">Ocupacion</Label>
              <Input
                id="occupation"
                value={formData.occupation || ''}
                onChange={(e) => handleChange('occupation', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="employer">Empleador</Label>
              <Input
                id="employer"
                value={formData.employer || ''}
                onChange={(e) => handleChange('employer', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="monthly_income">Ingreso Mensual</Label>
              <Input
                id="monthly_income"
                type="number"
                value={formData.monthly_income || ''}
                onChange={(e) => handleChange('monthly_income', parseFloat(e.target.value) || null)}
                placeholder="$0.00"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Limite de Credito */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Limite de Credito
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-w-sm">
            <Label htmlFor="credit_limit">Limite de Credito Inicial</Label>
            <Input
              id="credit_limit"
              type="number"
              value={creditLimit || ''}
              onChange={(e) => setCreditLimit(parseFloat(e.target.value) || undefined)}
              placeholder="$0.00"
            />
            <p className="text-sm text-muted-foreground">
              Dejalo vacio para asignar el limite despues
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Notas */}
      <Card>
        <CardHeader>
          <CardTitle>Notas Adicionales</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={formData.notes || ''}
            onChange={(e) => handleChange('notes', e.target.value)}
            placeholder="Observaciones sobre el cliente..."
            rows={4}
          />
        </CardContent>
      </Card>

      {/* Estado (solo en edicion) */}
      {isEditing && (
        <Card>
          <CardHeader>
            <CardTitle>Estado del Cliente</CardTitle>
          </CardHeader>
          <CardContent>
            <Select
              value={formData.status || 'active'}
              onValueChange={(value) => handleChange('status', value)}
            >
              <SelectTrigger className="max-w-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Activo</SelectItem>
                <SelectItem value="inactive">Inactivo</SelectItem>
                <SelectItem value="blocked">Bloqueado (mora)</SelectItem>
                <SelectItem value="suspended">Suspendido</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      {/* Submit */}
      <div className="flex justify-end gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => navigate(-1)}
          disabled={isLoading}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? (
            <>
              <Spinner className="mr-2" />
              Guardando...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              {isEditing ? 'Guardar Cambios' : 'Crear Cliente'}
            </>
          )}
        </Button>
      </div>
    </form>
  )
}
