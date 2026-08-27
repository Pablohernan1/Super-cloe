import { CreditLimitForm } from './credit-limit-form'
import { PageHeader } from '@/components/ui/page-header'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ShieldAlert } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { canManageCreditLimits } from '@/lib/permissions'

export default function NewCreditLimitPage() {
  const { profile } = useAuth()

  if (profile && !canManageCreditLimits(profile.role as any)) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Nuevo Límite de Crédito" />
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertDescription>Esta acción es exclusiva de supervisor y administrador.</AlertDescription>
        </Alert>
      </div>
    )
  }

  return <CreditLimitForm />
}
