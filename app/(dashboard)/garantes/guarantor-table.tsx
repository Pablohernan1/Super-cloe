'use client'

import { useState } from 'react'
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
import { Eye, ToggleLeft } from 'lucide-react'
import Link from 'next/link'
import { GuarantorActions } from './guarantor-actions'

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

interface GuarantorTableProps {
  relations: GuarantorRelation[]
  onRefresh: () => void
}

const statusColors = {
  active: 'bg-green-100 text-green-800',
  inactive: 'bg-gray-100 text-gray-800',
  blocked: 'bg-yellow-100 text-yellow-800',
  defaulted: 'bg-red-100 text-red-800',
}

const statusLabels = {
  active: 'Activo',
  inactive: 'Inactivo',
  blocked: 'Bloqueado',
  defaulted: 'En Mora',
}

export function GuarantorTable({ relations, onRefresh }: GuarantorTableProps) {
  const [loading, setLoading] = useState(false)

  const getCustomerName = (customer: any) => {
    return `${customer.first_name} ${customer.last_name}`
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Titular</TableHead>
            <TableHead>CUIT/CUIL Titular</TableHead>
            <TableHead>Garante</TableHead>
            <TableHead>CUIT/CUIL Garante</TableHead>
            <TableHead>Estado Relación</TableHead>
            <TableHead>Estado Garante</TableHead>
            <TableHead>Fecha Alta</TableHead>
            <TableHead>Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {relations.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                No hay relaciones de garantía registradas
              </TableCell>
            </TableRow>
          ) : (
            relations.map((relation) => (
              <TableRow key={relation.id}>
                <TableCell>{getCustomerName(relation.titular)}</TableCell>
                <TableCell className="font-mono text-sm">{relation.titular.cuit_cuil}</TableCell>
                <TableCell>{getCustomerName(relation.guarantor)}</TableCell>
                <TableCell className="font-mono text-sm">{relation.guarantor.cuit_cuil}</TableCell>
                <TableCell>
                  <Badge className={statusColors[relation.status as keyof typeof statusColors]}>
                    {statusLabels[relation.status as keyof typeof statusLabels]}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge
                    className={statusColors[relation.guarantor.status as keyof typeof statusColors]}
                    variant={
                      relation.guarantor.status === 'active' ? 'default' : 'secondary'
                    }
                  >
                    {statusLabels[relation.guarantor.status as keyof typeof statusLabels]}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">
                  {new Date(relation.created_at).toLocaleDateString('es-AR')}
                </TableCell>
                <TableCell>
                  <GuarantorActions
                    relation={relation}
                    onRefresh={onRefresh}
                  />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
