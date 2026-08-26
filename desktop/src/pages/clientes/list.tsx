import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { CustomersTable } from './customers-table'
import { useAuth } from '@/lib/auth-context'
import { canCreate } from '@/lib/permissions'

export default function ClientesListPage() {
  const { profile } = useAuth()
  const [customers, setCustomers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const userCanCreate = canCreate(profile?.role as any)

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from('customers')
        .select(`*, credit_limits ( approved_limit, available_credit )`)
        .order('created_at', { ascending: false })

      if (error) console.error('Error fetching customers:', error)
      setCustomers(data || [])
      setLoading(false)
    }
    load()
  }, [])

  const totalCustomers = customers.length
  const activeCustomers = customers.filter((c) => c.status === 'active').length
  const blockedCustomers = customers.filter((c) => c.status === 'blocked').length
  const suspendedCustomers = customers.filter((c) => c.status === 'suspended').length

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Clientes" description="Gestion de clientes del sistema de financiamiento">
        {userCanCreate && (
          <Link to="/clientes/nuevo">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Cliente
            </Button>
          </Link>
        )}
      </PageHeader>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{totalCustomers}</div>
            <p className="text-xs text-muted-foreground">Total Clientes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">{activeCustomers}</div>
            <p className="text-xs text-muted-foreground">Activos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-red-600">{blockedCustomers}</div>
            <p className="text-xs text-muted-foreground">Bloqueados (mora)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-yellow-600">{suspendedCustomers}</div>
            <p className="text-xs text-muted-foreground">Suspendidos</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Cargando...</div>
          ) : (
            <CustomersTable customers={customers} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
