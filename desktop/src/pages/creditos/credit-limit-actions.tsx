import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Check, X, Loader } from 'lucide-react'
import type { CreditLimit, UserRole } from '@/lib/types'

interface CreditLimitActionsProps {
  creditLimit: CreditLimit
  userRole: UserRole | null
  onDone?: () => void
}

export function CreditLimitActions({ creditLimit, userRole, onDone }: CreditLimitActionsProps) {
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(false)
  const [openDialog, setOpenDialog] = useState<'approve' | 'reject' | null>(null)

  const canDecide = userRole && ['supervisor', 'administrador'].includes(userRole) && creditLimit.status === 'pending_approval'

  const handleDecision = async (decision: 'approved' | 'rejected') => {
    setIsLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const patch: any = { status: decision, updated_by: user?.id, updated_at: new Date().toISOString() }
      if (decision === 'approved') {
        patch.approved_by = user?.id
        patch.approved_at = new Date().toISOString()
      }

      // Bloqueado por RLS para cualquiera que no sea supervisor/administrador
      // (credit_limits_update_supervisor) -- este check de rol acá es solo UX.
      const { error } = await supabase.from('credit_limits').update(patch).eq('id', creditLimit.id)

      if (!error) {
        setOpenDialog(null)
        onDone ? onDone() : navigate(0)
      } else {
        alert(`Error: ${error.message}`)
      }
    } finally {
      setIsLoading(false)
    }
  }

  if (!canDecide) return null

  return (
    <>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => setOpenDialog('approve')} disabled={isLoading} className="bg-green-600 hover:bg-green-700">
          {isLoading ? <Loader className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
          Aprobar
        </Button>
        <Button variant="destructive" size="sm" onClick={() => setOpenDialog('reject')} disabled={isLoading}>
          {isLoading ? <Loader className="h-4 w-4 mr-2 animate-spin" /> : <X className="h-4 w-4 mr-2" />}
          Rechazar
        </Button>
      </div>

      <AlertDialog open={openDialog !== null} onOpenChange={(open) => !open && setOpenDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{openDialog === 'approve' ? 'Aprobar Límite de Crédito' : 'Rechazar Límite de Crédito'}</AlertDialogTitle>
            <AlertDialogDescription>
              {openDialog === 'approve'
                ? '¿Está seguro que desea aprobar este límite de crédito?'
                : '¿Está seguro que desea rechazar este límite de crédito?'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-3 justify-end">
            <AlertDialogCancel disabled={isLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleDecision(openDialog === 'approve' ? 'approved' : 'rejected')}
              disabled={isLoading}
              className={openDialog === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-destructive'}
            >
              {isLoading && <Loader className="h-4 w-4 mr-2 animate-spin" />}
              {openDialog === 'approve' ? 'Aprobar' : 'Rechazar'}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
