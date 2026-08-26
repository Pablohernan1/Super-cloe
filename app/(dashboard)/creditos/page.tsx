'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Filter } from 'lucide-react'
import Link from 'next/link'
import { CreditLimitTable } from './credit-limits-table'
import { useAuth } from '@/lib/auth-context'
import { canCreate } from '@/lib/permissions'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface CreditLimitData {
  id: string
  customer_id: string
  approved_limit: number
  committed_limit: number
  available_credit: number
  status: string
  created_at: string
  guarantors_active_count: number
  eligible_for_extension: boolean
  customer: {
    id: string
    first_name: string
    last_name: string
    customer_code: string
    cuit_cuil: string
  }
}

export default function CreditLimitsPage() {
  const supabase = createClient()
  const { profile } = useAuth()
  const [limits, setLimits] = useState<CreditLimitData[]>([])
  const [filteredLimits, setFilteredLimits] = useState<CreditLimitData[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const userCanCreate = canCreate(profile?.role as any)

  const fetchLimits = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('credit_limits')
        .select(`
          *,
          customer:customer_id (id, first_name, last_name, customer_code, cuit_cuil)
        `)
        .order('created_at', { ascending: false })

      console.log("[v0] Fetched credit limits data:", data)
      console.log("[v0] Fetch error:", error)
      setLimits(data || [])
    } catch (error) {
      console.error('Error fetching credit limits:', error)
    } finally {
      setLoading(false)
    }
  }

  // Filter limits based on status
  useEffect(() => {
    if (statusFilter === 'all') {
      setFilteredLimits(limits)
    } else {
      setFilteredLimits(limits.filter(l => l.status === statusFilter))
    }
  }, [limits, statusFilter])

  useEffect(() => {
    fetchLimits()
  }, [])

  const totalLimits = limits.length
  const approvedLimits = limits.filter(l => l.status === 'approved').length
  const pendingLimits = limits.filter(l => l.status === 'pending_approval').length
  const totalApprovedAmount = limits
    .filter(l => l.status === 'approved')
    .reduce((sum, l) => sum + l.approved_limit, 0)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Límites de Crédito"
        description="Gestión de límites de crédito por cliente"
      >
        {userCanCreate && (
          <Link href="/creditos/nuevo">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Límite
            </Button>
          </Link>
        )}
      </PageHeader>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{totalLimits}</div>
            <p className="text-xs text-muted-foreground">Total Límites</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">{approvedLimits}</div>
            <p className="text-xs text-muted-foreground">Aprobados</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-yellow-600">{pendingLimits}</div>
            <p className="text-xs text-muted-foreground">Pendientes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-lg font-bold">${totalApprovedAmount.toLocaleString('es-AR')}</div>
            <p className="text-xs text-muted-foreground">Monto Total Aprobado</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="pending_approval">Pendiente Aprobación</SelectItem>
            <SelectItem value="approved">Aprobado</SelectItem>
            <SelectItem value="rejected">Rechazado</SelectItem>
            <SelectItem value="suspended">Suspendido</SelectItem>
            <SelectItem value="expired">Expirado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Limits Table */}
      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Cargando...</div>
          ) : (
            <CreditLimitTable limits={filteredLimits} onRefresh={fetchLimits} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
