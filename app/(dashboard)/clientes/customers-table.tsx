'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Search, Eye, Edit, ChevronLeft, ChevronRight, User, Building2 } from 'lucide-react'
import { CurrencyDisplay } from '@/components/ui/currency-display'
import { useAuth } from '@/lib/auth-context'
import { canUpdate } from '@/lib/permissions'

type Customer = {
  id: string
  customer_code: string
  person_type: 'fisica' | 'juridica'
  document_type: string
  document_number: string
  first_name: string
  last_name: string
  razon_social: string | null
  cuit_cuil: string | null
  phone: string | null
  email: string | null
  city: string | null
  status: string
  created_at: string
  credit_limits?: {
    approved_limit: number
    available_credit: number
  }[] | null
}

interface CustomersTableProps {
  customers: Customer[]
}

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  inactive: 'bg-gray-100 text-gray-800',
  blocked: 'bg-red-100 text-red-800',
  suspended: 'bg-yellow-100 text-yellow-800',
}

const statusLabels: Record<string, string> = {
  active: 'Activo',
  inactive: 'Inactivo',
  blocked: 'Bloqueado (mora)',
  suspended: 'Suspendido',
}

export function CustomersTable({ customers }: CustomersTableProps) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10
  const { profile } = useAuth()
  const userCanUpdate = canUpdate(profile?.role)

  // Filter customers
  const filteredCustomers = customers.filter((customer) => {
    const searchLower = search.toLowerCase()
    const matchesSearch =
      customer.customer_code.toLowerCase().includes(searchLower) ||
      customer.first_name.toLowerCase().includes(searchLower) ||
      customer.last_name.toLowerCase().includes(searchLower) ||
      customer.document_number.includes(search) ||
      (customer.razon_social?.toLowerCase().includes(searchLower) ?? false) ||
      (customer.cuit_cuil?.includes(search) ?? false)

    const matchesStatus = statusFilter === 'all' || customer.status === statusFilter
    const matchesType = typeFilter === 'all' || customer.person_type === typeFilter

    return matchesSearch && matchesStatus && matchesType
  })

  // Pagination
  const totalPages = Math.ceil(filteredCustomers.length / pageSize)
  const startIndex = (currentPage - 1) * pageSize
  const paginatedCustomers = filteredCustomers.slice(startIndex, startIndex + pageSize)

  const getDisplayName = (customer: Customer) => {
    if (customer.person_type === 'juridica' && customer.razon_social) {
      return customer.razon_social
    }
    return `${customer.last_name}, ${customer.first_name}`
  }

  const getDocumentDisplay = (customer: Customer) => {
    if (customer.person_type === 'juridica' && customer.cuit_cuil) {
      return `CUIT: ${customer.cuit_cuil}`
    }
    return `${customer.document_type}: ${customer.document_number}`
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, codigo, documento..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setCurrentPage(1)
            }}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Select
            value={typeFilter}
            onValueChange={(value) => {
              setTypeFilter(value)
              setCurrentPage(1)
            }}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="fisica">Persona Fisica</SelectItem>
              <SelectItem value="juridica">Persona Juridica</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={statusFilter}
            onValueChange={(value) => {
              setStatusFilter(value)
              setCurrentPage(1)
            }}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Activo</SelectItem>
              <SelectItem value="inactive">Inactivo</SelectItem>
              <SelectItem value="blocked">Bloqueado</SelectItem>
              <SelectItem value="defaulted">En Mora</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Codigo</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Nombre / Razon Social</TableHead>
              <TableHead>Documento</TableHead>
              <TableHead>Telefono</TableHead>
              <TableHead>Localidad</TableHead>
              <TableHead>Limite Credito</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedCustomers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  No se encontraron clientes
                </TableCell>
              </TableRow>
            ) : (
              paginatedCustomers.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell className="font-medium">{customer.customer_code}</TableCell>
                  <TableCell>
                    {customer.person_type === 'fisica' ? (
                      <User className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                    )}
                  </TableCell>
                  <TableCell>{getDisplayName(customer)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {getDocumentDisplay(customer)}
                  </TableCell>
                  <TableCell>{customer.phone || '-'}</TableCell>
                  <TableCell>{customer.city || '-'}</TableCell>
                  <TableCell>
                    {customer.credit_limits?.[0] ? (
                      <CurrencyDisplay amount={customer.credit_limits[0].approved_limit} />
                    ) : (
                      <span className="text-muted-foreground">Sin limite</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={statusColors[customer.status] || statusColors.inactive}>
                      {statusLabels[customer.status] || customer.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Link href={`/clientes/${customer.id}`}>
                        <Button variant="ghost" size="icon" title="Ver detalles">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                      {userCanUpdate && (
                        <Link href={`/clientes/${customer.id}/editar`}>
                          <Button variant="ghost" size="icon" title="Editar cliente">
                            <Edit className="h-4 w-4" />
                          </Button>
                        </Link>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Mostrando {startIndex + 1} a {Math.min(startIndex + pageSize, filteredCustomers.length)} de {filteredCustomers.length} clientes
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">
              Pagina {currentPage} de {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
