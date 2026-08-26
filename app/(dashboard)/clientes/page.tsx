import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import Link from 'next/link'
import { CustomersTable } from './customers-table'
import { canCreate } from '@/lib/permissions'

export default async function CustomersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  let userRole: string | null = null
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    
    userRole = profile?.role || null
  }

  const { data: customers, error } = await supabase
    .from('customers')
    .select(`
      *,
      credit_limits (
        approved_limit,
        available_credit
      )
    `)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching customers:', error)
  }

  const totalCustomers = customers?.length || 0
  const activeCustomers = customers?.filter(c => c.status === 'active').length || 0
  const blockedCustomers = customers?.filter(c => c.status === 'blocked').length || 0
  const suspendedCustomers = customers?.filter(c => c.status === 'suspended').length || 0
  const userCanCreate = canCreate(userRole as any)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Clientes"
        description="Gestion de clientes del sistema de financiamiento"
      >
        {userCanCreate && (
          <Link href="/clientes/nuevo">
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
          <CustomersTable customers={customers || []} />
        </CardContent>
      </Card>
    </div>
  )
}
