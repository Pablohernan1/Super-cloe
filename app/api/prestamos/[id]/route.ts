import { createClient } from '@/lib/supabase/server'
import { updateLoanStatus, getLoanWithDetails, approveLoan } from '@/lib/services/loan-service'
import { createAuditLog } from '@/lib/audit-logger'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const loanData = await getLoanWithDetails(id)

    if (!loanData) {
      return Response.json({ error: 'Loan not found' }, { status: 404 })
    }

    return Response.json({
      success: true,
      loan: loanData,
    })
  } catch (error) {
    console.error('[v0] Error in GET /api/prestamos/[id]:', error)
    return Response.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const canApproveLoan = ['supervisor', 'administrador'].includes(userProfile?.role || '')
    if (!canApproveLoan) {
      return Response.json({ error: 'Forbidden - insufficient permissions' }, { status: 403 })
    }

    const { action, status, rejection_reason } = await request.json()

    console.log('[v0] Loan action:', { id, action, status })

    let updatedLoan = null

    if (action === 'approve') {
      // Approve and update credit limit
      updatedLoan = await approveLoan(id, user.id)
    } else if (action === 'reject') {
      // Just reject
      updatedLoan = await updateLoanStatus(id, 'rejected', user.id, rejection_reason)
    } else if (status) {
      // Generic status update
      updatedLoan = await updateLoanStatus(id, status, user.id, rejection_reason)
    }

    if (!updatedLoan) {
      return Response.json({ error: 'Failed to update loan' }, { status: 500 })
    }

    console.log('[v0] Loan updated successfully')

    return Response.json({
      success: true,
      loan: updatedLoan,
    })
  } catch (error) {
    console.error('[v0] Error in PATCH /api/prestamos/[id]:', error)
    return Response.json({ error: 'Server error' }, { status: 500 })
  }
}
