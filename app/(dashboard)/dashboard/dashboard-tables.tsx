'use client'

import { DataTable, type Column } from '@/components/ui/data-table'
import { StatusBadge } from '@/components/ui/status-badge'
import { CurrencyDisplay } from '@/components/ui/currency-display'
import type { Loan } from '@/lib/types'

type LoanWithCustomer = Loan & { 
  customer?: { 
    first_name: string
    last_name: string
    customer_code: string 
  } 
}

type OverdueInstallment = {
  id: string
  due_date: string
  total_amount: number
  loan: {
    loan_number: string
    customer: { 
      first_name: string
      last_name: string
      phone: string | null 
    }
  }
}

interface RecentLoansTableProps {
  data: LoanWithCustomer[]
}

export function RecentLoansTable({ data }: RecentLoansTableProps) {
  const columns: Column<LoanWithCustomer>[] = [
    {
      key: 'loan_number',
      header: 'Prestamo',
      cell: (row) => (
        <span className="font-medium">{row.loan_number}</span>
      ),
    },
    {
      key: 'customer',
      header: 'Cliente',
      cell: (row) => row.customer ? `${row.customer.first_name} ${row.customer.last_name}` : '-',
    },
    {
      key: 'total_amount',
      header: 'Monto',
      cell: (row) => <CurrencyDisplay amount={row.total_amount} />,
    },
    {
      key: 'status',
      header: 'Estado',
      cell: (row) => <StatusBadge status={row.status} />,
    },
  ]

  return (
    <DataTable
      columns={columns}
      data={data}
      searchable={false}
      pageSize={5}
      emptyMessage="No hay prestamos recientes"
    />
  )
}

interface OverdueInstallmentsTableProps {
  data: OverdueInstallment[]
}

export function OverdueInstallmentsTable({ data }: OverdueInstallmentsTableProps) {
  const columns: Column<OverdueInstallment>[] = [
    {
      key: 'loan',
      header: 'Cliente',
      cell: (row) => (
        <div>
          <p className="font-medium">
            {row.loan.customer.first_name} {row.loan.customer.last_name}
          </p>
          <p className="text-xs text-muted-foreground">{row.loan.loan_number}</p>
        </div>
      ),
    },
    {
      key: 'due_date',
      header: 'Vencimiento',
      cell: (row) => new Date(row.due_date).toLocaleDateString('es-AR'),
    },
    {
      key: 'total_amount',
      header: 'Monto',
      cell: (row) => <CurrencyDisplay amount={row.total_amount} />,
    },
    {
      key: 'phone',
      header: 'Telefono',
      cell: (row) => row.loan.customer.phone || '-',
    },
  ]

  return (
    <DataTable
      columns={columns}
      data={data}
      searchable={false}
      pageSize={5}
      emptyMessage="No hay cuotas vencidas"
    />
  )
}
