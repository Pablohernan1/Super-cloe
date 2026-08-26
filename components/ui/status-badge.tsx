import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import type { LoanStatus, InstallmentStatus, AccountStatus } from '@/lib/types'

type StatusType = LoanStatus | InstallmentStatus | AccountStatus | string

interface StatusBadgeProps {
  status: StatusType
  className?: string
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  // Loan statuses
  pending: { label: 'Pendiente', variant: 'secondary' },
  approved: { label: 'Aprobado', variant: 'default' },
  rejected: { label: 'Rechazado', variant: 'destructive' },
  active: { label: 'Activo', variant: 'default' },
  completed: { label: 'Completado', variant: 'outline' },
  defaulted: { label: 'En Mora', variant: 'destructive' },
  cancelled: { label: 'Cancelado', variant: 'outline' },
  // Installment statuses
  paid: { label: 'Pagado', variant: 'default' },
  partial: { label: 'Parcial', variant: 'secondary' },
  overdue: { label: 'Vencido', variant: 'destructive' },
  // Account statuses
  blocked: { label: 'Bloqueado', variant: 'destructive' },
  pending_password_change: { label: 'Cambiar Clave', variant: 'secondary' },
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] || { label: status, variant: 'outline' as const }

  return (
    <Badge variant={config.variant} className={cn('capitalize', className)}>
      {config.label}
    </Badge>
  )
}

// Specialized variants for better type safety
export function LoanStatusBadge({ status, className }: { status: LoanStatus; className?: string }) {
  return <StatusBadge status={status} className={className} />
}

export function InstallmentStatusBadge({ status, className }: { status: InstallmentStatus; className?: string }) {
  return <StatusBadge status={status} className={className} />
}

export function AccountStatusBadge({ status, className }: { status: AccountStatus; className?: string }) {
  return <StatusBadge status={status} className={className} />
}
