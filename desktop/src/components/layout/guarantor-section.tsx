import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, Users } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface GuarantorSectionProps {
  customerId: string
  isGuarantor: boolean
}

export function GuarantorSection({ customerId, isGuarantor }: GuarantorSectionProps) {
  const [guarantorsOf, setGuarantorsOf] = useState<any[]>([])
  const [guaranteesFor, setGuaranteesFor] = useState<any[]>([])

  useEffect(() => {
    const load = async () => {
      const { data: gOf } = await supabase
        .from('guarantor_relations')
        .select(`id, status, guarantor:guarantor_customer_id ( id, first_name, last_name, customer_code, cuit_cuil, status )`)
        .eq('titular_customer_id', customerId)
        .eq('status', 'active')

      const { data: gFor } = await supabase
        .from('guarantor_relations')
        .select(`id, status, titular:titular_customer_id ( id, first_name, last_name, customer_code, cuit_cuil, status )`)
        .eq('guarantor_customer_id', customerId)
        .eq('status', 'active')

      setGuarantorsOf(gOf || [])
      setGuaranteesFor(gFor || [])
    }
    load()
  }, [customerId])

  const activeGuarantors = guarantorsOf.length
  const activeGuarantees = guaranteesFor.length
  const hasBlockedGuarantors = guarantorsOf.some((g) => g.guarantor?.status !== 'active')

  return (
    <div className="space-y-4">
      {hasBlockedGuarantors && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Este cliente tiene garantes con estado no activo (bloqueado, inactivo o en mora). Esto puede afectar su
            capacidad de crédito.
          </AlertDescription>
        </Alert>
      )}

      {activeGuarantors < 1 && isGuarantor && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Este cliente debe tener al menos 1 garante activo para acceder a créditos.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Garantes Asociados
            </CardTitle>
            <CardDescription>
              {activeGuarantors} garante(s) activo(s)
              {activeGuarantors >= 2 && <span className="ml-2 text-green-600">(Cumple mínimo para ampliación)</span>}
              {activeGuarantors === 1 && <span className="ml-2 text-yellow-600">(Mínimo requerido)</span>}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {guarantorsOf.length === 0 ? (
              <p className="text-muted-foreground text-sm">Sin garantes registrados</p>
            ) : (
              <div className="space-y-3">
                {guarantorsOf.map((relation) => (
                  <div key={relation.id} className="flex items-center justify-between p-3 border rounded">
                    <div>
                      <p className="font-medium text-sm">
                        {relation.guarantor?.first_name} {relation.guarantor?.last_name}
                      </p>
                      <p className="text-xs text-muted-foreground font-mono">{relation.guarantor?.cuit_cuil}</p>
                    </div>
                    <Badge className={relation.guarantor?.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                      {relation.guarantor?.status === 'active' ? 'Activo' : 'No Activo'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Este Cliente Garantiza a
            </CardTitle>
            <CardDescription>{activeGuarantees} cliente(s) como garante</CardDescription>
          </CardHeader>
          <CardContent>
            {guaranteesFor.length === 0 ? (
              <p className="text-muted-foreground text-sm">No es garante de ningún cliente</p>
            ) : (
              <div className="space-y-3">
                {guaranteesFor.map((relation) => (
                  <div key={relation.id} className="flex items-center justify-between p-3 border rounded">
                    <div>
                      <p className="font-medium text-sm">
                        {relation.titular?.first_name} {relation.titular?.last_name}
                      </p>
                      <p className="text-xs text-muted-foreground font-mono">{relation.titular?.cuit_cuil}</p>
                    </div>
                    <Badge className="bg-blue-100 text-blue-800">
                      {relation.titular?.status === 'active' ? 'Activo' : 'No Activo'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
