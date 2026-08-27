import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, Users } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import Link from 'next/link'

interface GuarantorSectionProps {
  customerId: string
  isGuarantor: boolean
}

export async function GuarantorSection({ customerId, isGuarantor }: GuarantorSectionProps) {
  const supabase = await createClient()

  // Fetch guarantors for this customer
  const { data: guarantorsOf } = await supabase
    .from('guarantor_relations')
    .select(`
      id,
      status,
      guarantor:guarantor_customer_id (
        id, first_name, last_name, customer_code, cuit_cuil, status
      )
    `)
    .eq('titular_customer_id', customerId)
    .eq('status', 'active')

  // Fetch customers this person guarantees for
  const { data: guaranteesFor } = await supabase
    .from('guarantor_relations')
    .select(`
      id,
      status,
      titular:titular_customer_id (
        id, first_name, last_name, customer_code, cuit_cuil, status
      )
    `)
    .eq('guarantor_customer_id', customerId)
    .eq('status', 'active')

  const activeGuarantors = guarantorsOf?.length || 0
  const activeGuarantees = guaranteesFor?.length || 0
  const hasBlockedGuarantors = guarantorsOf?.some(g => g.guarantor?.status !== 'active') || false

  return (
    <div className="space-y-4">
      {/* Alerts */}
      {hasBlockedGuarantors && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Este cliente tiene garantes con estado no activo (bloqueado, inactivo o en mora). Esto puede afectar su capacidad de crédito.
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
        {/* Garantes Asociados */}
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
            {!guarantorsOf || guarantorsOf.length === 0 ? (
              <p className="text-muted-foreground text-sm">Sin garantes registrados</p>
            ) : (
              <div className="space-y-3">
                {guarantorsOf.map((relation) => (
                  <Link
                    key={relation.id}
                    href={`/clientes/${relation.guarantor?.id}`}
                    className="flex items-center justify-between p-3 border rounded hover:bg-muted transition-colors"
                  >
                    <div>
                      <p className="font-medium text-sm hover:underline">
                        {relation.guarantor?.first_name} {relation.guarantor?.last_name}
                      </p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {relation.guarantor?.cuit_cuil}
                      </p>
                    </div>
                    <Badge
                      className={
                        relation.guarantor?.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }
                    >
                      {relation.guarantor?.status === 'active' ? 'Activo' : 'No Activo'}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Garantiza para */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Este Cliente Garantiza a
            </CardTitle>
            <CardDescription>
              {activeGuarantees} cliente(s) como garante
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!guaranteesFor || guaranteesFor.length === 0 ? (
              <p className="text-muted-foreground text-sm">No es garante de ningún cliente</p>
            ) : (
              <div className="space-y-3">
                {guaranteesFor.map((relation) => (
                  <Link
                    key={relation.id}
                    href={`/clientes/${relation.titular?.id}`}
                    className="flex items-center justify-between p-3 border rounded hover:bg-muted transition-colors"
                  >
                    <div>
                      <p className="font-medium text-sm hover:underline">
                        {relation.titular?.first_name} {relation.titular?.last_name}
                      </p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {relation.titular?.cuit_cuil}
                      </p>
                    </div>
                    <Badge className="bg-blue-100 text-blue-800">
                      {relation.titular?.status === 'active' ? 'Activo' : 'No Activo'}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
