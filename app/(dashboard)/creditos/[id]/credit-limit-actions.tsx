'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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
import { Check, X, Edit2, Loader } from 'lucide-react'
import type { CreditLimit, UserRole } from '@/lib/types'

interface CreditLimitActionsProps {
  creditLimit: CreditLimit
  userRole: UserRole | null
}

export function CreditLimitActions({ creditLimit, userRole }: CreditLimitActionsProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [openDialog, setOpenDialog] = useState<'approve' | 'reject' | null>(null)

  const canEdit = userRole && ['supervisor', 'administrador'].includes(userRole) && creditLimit.status === 'pending_approval'
  const canApprove = userRole && ['supervisor', 'administrador'].includes(userRole) && creditLimit.status === 'pending_approval'
  const canReject = userRole && ['supervisor', 'administrador'].includes(userRole) && creditLimit.status === 'pending_approval'

  const handleApprove = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/credit-limits/${creditLimit.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      })
      if (response.ok) {
        router.refresh()
        setOpenDialog(null)
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleReject = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/credit-limits/${creditLimit.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject' }),
      })
      if (response.ok) {
        router.refresh()
        setOpenDialog(null)
      }
    } finally {
      setIsLoading(false)
    }
  }

  if (!canEdit && !canApprove && !canReject) {
    return null
  }

  return (
    <>
      <div className="flex gap-2">
        {canEdit && (
          <Button variant="outline" size="sm" onClick={() => router.push(`/creditos/${creditLimit.id}/editar`)}>
            <Edit2 className="h-4 w-4 mr-2" />
            Editar
          </Button>
        )}
        {canApprove && (
          <Button 
            size="sm" 
            onClick={() => setOpenDialog('approve')}
            disabled={isLoading}
            className="bg-green-600 hover:bg-green-700"
          >
            {isLoading ? <Loader className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
            Aprobar
          </Button>
        )}
        {canReject && (
          <Button 
            variant="destructive" 
            size="sm" 
            onClick={() => setOpenDialog('reject')}
            disabled={isLoading}
          >
            {isLoading ? <Loader className="h-4 w-4 mr-2 animate-spin" /> : <X className="h-4 w-4 mr-2" />}
            Rechazar
          </Button>
        )}
      </div>

      <AlertDialog open={openDialog !== null} onOpenChange={(open) => !open && setOpenDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {openDialog === 'approve' ? 'Aprobar Límite de Crédito' : 'Rechazar Límite de Crédito'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {openDialog === 'approve' 
                ? '¿Está seguro que desea aprobar este límite de crédito?'
                : '¿Está seguro que desea rechazar este límite de crédito?'
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-3 justify-end">
            <AlertDialogCancel disabled={isLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={openDialog === 'approve' ? handleApprove : handleReject}
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
