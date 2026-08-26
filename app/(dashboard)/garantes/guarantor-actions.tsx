'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Eye, ToggleLeft } from 'lucide-react'
import Link from 'next/link'
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
  titular_customer_id: string
  guarantor_customer_id: string
  status: string
  titular: {
    first_name: string
    last_name: string
  }
  guarantor: {
    first_name: string
    last_name: string
  }
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
      const response = await fetch('/api/guarantors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          relation_id: relation.id,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        alert(`Error: ${error.error}`)
        return
      }

      setShowDialog(false)
      onRefresh()
    } catch (error) {
      alert('Error updating guarantor relation')
    } finally {
      setLoading(false)
    }
  }

  const actionLabel = relation.status === 'active' ? 'Inactivar' : 'Reactivar'
  const actionMessage = relation.status === 'active'
    ? `¿Desactivar la relación de garantía entre ${relation.titular.first_name} y ${relation.guarantor.first_name}?`
    : `¿Reactivar la relación de garantía entre ${relation.titular.first_name} y ${relation.guarantor.first_name}?`

  return (
    <>
      <div className="flex gap-2">
        <Link href={`/garantes/${relation.id}`}>
          <Button variant="ghost" size="icon" title="Ver detalle">
            <Eye className="h-4 w-4" />
          </Button>
        </Link>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowDialog(true)}
          title={actionLabel}
        >
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
