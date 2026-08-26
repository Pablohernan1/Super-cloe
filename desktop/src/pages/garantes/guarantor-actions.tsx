import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { ToggleLeft } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface GuarantorRelation {
  id: string
  status: string
  titular: { first_name: string; last_name: string }
  guarantor: { first_name: string; last_name: string }
}

interface GuarantorActionsProps {
  relation: GuarantorRelation
  onRefresh: () => void
}

export function GuarantorActions({ relation, onRefresh }: GuarantorActionsProps) {
  const [loading, setLoading] = useState(false)
  const [showDialog, setShowDialog] = useState(false)

  const handleToggleStatus = async () => {
    setLoading(true)
    try {
      const newStatus = relation.status === 'active' ? 'inactive' : 'active'
      const { error } = await supabase
        .from('guarantor_relations')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', relation.id)

      if (error) {
        alert(`Error: ${error.message}`)
        return
      }

      setShowDialog(false)
      onRefresh()
    } catch (error) {
      alert('Error actualizando la relación de garantía')
    } finally {
      setLoading(false)
    }
  }

  const actionLabel = relation.status === 'active' ? 'Inactivar' : 'Reactivar'
  const actionMessage =
    relation.status === 'active'
      ? `¿Desactivar la relación de garantía entre ${relation.titular.first_name} y ${relation.guarantor.first_name}?`
      : `¿Reactivar la relación de garantía entre ${relation.titular.first_name} y ${relation.guarantor.first_name}?`

  return (
    <>
      <div className="flex gap-2">
        <Button variant="ghost" size="icon" onClick={() => setShowDialog(true)} title={actionLabel}>
          <ToggleLeft className="h-4 w-4" />
        </Button>
      </div>

      <AlertDialog open={showDialog} onOpenChange={setShowDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{actionLabel} Relación</AlertDialogTitle>
            <AlertDialogDescription>{actionMessage}</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-4">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleToggleStatus} disabled={loading}>
              {loading ? 'Procesando...' : actionLabel}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
