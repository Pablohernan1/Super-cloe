'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import Link from 'next/link'
import { GuarantorTable } from './guarantor-table'
import { useAuth } from '@/lib/auth-context'
import { canCreate } from '@/lib/permissions'

interface GuarantorRelation {
  id: string
  titular_customer_id: string
  guarantor_customer_id: string
  status: string
  created_at: string
  titular: {
    id: string
    first_name: string
    last_name: string
    customer_code: string
    cuit_cuil: string
    status: string
  }
  guarantor: {
    id: string
    first_name: string
    last_name: string
    customer_code: string
    cuit_cuil: string
    status: string
  }
}

export default function GuarantorsPage() {
  const supabase = createClient()
  const { profile } = useAuth()
  const [relations, setRelations] = useState<GuarantorRelation[]>([])
  const [loading, setLoading] = useState(true)
  const userCanCreate = canCreate(profile?.role as any)

  const fetchRelations = async () => {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('guarantor_relations')
        .select(`
          *,
          titular:titular_customer_id (id, first_name, last_name, customer_code, cuit_cuil, status),
          guarantor:guarantor_customer_id (id, first_name, last_name, customer_code, cuit_cuil, status)
        `)
        .order('created_at', { ascending: false })

      setRelations(data || [])
    } catch (error) {
      console.error('Error fetching guarantor relations:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRelations()
  }, [])

  const totalRelations = relations.length
  const activeRelations = relations.filter(r => r.status === 'active').length
  const inactiveRelations = relations.filter(r => r.status === 'inactive').length
  const relationsWithBlockedGuarantors = relations.filter(r => r.guarantor.status !== 'active').length

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Garantes"
        description="Gestión de relaciones de garantía entre clientes"
      >
        {userCanCreate && (
          <Link href="/garantes/nuevo">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Garante
            </Button>
          </Link>
        )}
      </PageHeader>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{totalRelations}</div>
            <p className="text-xs text-muted-foreground">Total Relaciones</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">{activeRelations}</div>
            <p className="text-xs text-muted-foreground">Activas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-gray-600">{inactiveRelations}</div>
            <p className="text-xs text-muted-foreground">Inactivas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-yellow-600">{relationsWithBlockedGuarantors}</div>
            <p className="text-xs text-muted-foreground">Garante no Activo</p>
          </CardContent>
        </Card>
      </div>

      {/* Relations Table */}
      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Cargando...</div>
          ) : (
            <GuarantorTable relations={relations} onRefresh={fetchRelations} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
