'use client'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Eye } from 'lucide-react'
import Link from 'next/link'

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

interface CreditLimitTableProps {
  limits: CreditLimitData[]
  onRefresh: () => void
}

const statusColors = {
  pending_approval: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  suspended: 'bg-orange-100 text-orange-800',
  expired: 'bg-gray-100 text-gray-800',
} as const

const getStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    pending_approval: 'Pendiente Aprobación',
    approved: 'Aprobado',
    rejected: 'Rechazado',
    suspended: 'Suspendido',
    expired: 'Expirado',
  }
  return labels[status] || status
}

export function CreditLimitTable({ limits, onRefresh }: CreditLimitTableProps) {
  if (!limits || limits.length === 0) {
    return <div className="text-center text-muted-foreground py-8">No hay límites de crédito registrados</div>
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Cliente</TableHead>
            <TableHead>CUIT/CUIL</TableHead>
            <TableHead className="text-right">Límite Aprobado</TableHead>
            <TableHead className="text-right">Comprometido</TableHead>
            <TableHead className="text-right">Disponible</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Garantes</TableHead>
            <TableHead>Ampliación</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead>Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {limits.map((limit) => (
            <TableRow key={limit.id}>
              <TableCell className="font-medium">
                {limit.customer?.first_name || 'N/A'} {limit.customer?.last_name || ''}
              </TableCell>
              <TableCell>{limit.customer?.cuit_cuil || 'N/A'}</TableCell>
              <TableCell className="text-right">
                ${(limit.approved_limit || 0).toLocaleString('es-AR')}
              </TableCell>
              <TableCell className="text-right">
                ${(limit.committed_limit || 0).toLocaleString('es-AR')}
              </TableCell>
              <TableCell className="text-right font-medium text-green-600">
                ${(limit.available_credit || 0).toLocaleString('es-AR')}
              </TableCell>
              <TableCell>
                <Badge className={statusColors[limit.status as keyof typeof statusColors] || 'bg-gray-100 text-gray-800'}>
                  {getStatusLabel(limit.status || 'unknown')}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant={limit.guarantors_active_count > 0 ? 'default' : 'secondary'}>
                  {limit.guarantors_active_count || 0}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant={limit.eligible_for_extension ? 'default' : 'outline'}>
                  {limit.eligible_for_extension ? 'Sí' : 'No'}
                </Badge>
              </TableCell>
              <TableCell>{limit.created_at ? new Date(limit.created_at).toLocaleDateString('es-AR') : 'N/A'}</TableCell>
              <TableCell>
                <div className="flex gap-2">
                  <Link href={`/creditos/${limit.id}`}>
                    <Button variant="ghost" size="sm">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
