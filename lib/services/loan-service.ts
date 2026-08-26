import { createClient } from '@/lib/supabase/server'
import type { Loan } from '@/lib/types'
import { createAuditLog } from '@/lib/audit-logger'

/**
 * Create a new loan atomically via the `create_loan` Postgres function.
 * Todas las validaciones críticas (cliente activo, garantes válidos,
 * disponible, topes) se revalidan ahí mismo -- ver
 * scripts/007_consolidated_schema.sql. Los garantes son los que el titular
 * ya tiene activos en guarantor_relations (spec: se asocian antes, en la
 * pantalla de garantes, no se eligen al momento del préstamo).
 */
export async function createLoan(
  customerId: string,
  principalAmount: number,
  termMonths: number,
  purpose?: string
): Promise<{ success: boolean; loan?: any; installments?: any[]; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'No hay usuario autenticado' }
  }

  const { data: guarantorRelations, error: guarantorsError } = await supabase
    .from('guarantor_relations')
    .select('guarantor_customer_id, customer:guarantor_customer_id(status)')
    .eq('titular_customer_id', customerId)
    .eq('status', 'active')

  if (guarantorsError) {
    return { success: false, error: guarantorsError.message }
  }

  const guarantorIds = (guarantorRelations || [])
    .filter((g: any) => g.customer?.status === 'active')
    .map((g) => g.guarantor_customer_id)

  const { data, error } = await supabase.rpc('create_loan', {
    p_customer_id: customerId,
    p_principal_amount: principalAmount,
    p_term_months: termMonths,
    p_guarantor_ids: guarantorIds,
    p_purpose: purpose || null,
  })

  if (error) {
    console.error('[v0] Error creating loan:', error)
    return { success: false, error: error.message }
  }

  return {
    success: true,
    loan: data.loan,
    installments: data.installments,
  }
}

/**
 * Update loan status
 */
export async function updateLoanStatus(
  loanId: string,
  newStatus: string,
  approvedBy?: string,
  rejectionReason?: string
): Promise<Loan | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  try {
    const updateData: any = {
      status: newStatus,
      updated_by: user.id,
    }

    if (newStatus === 'approved') {
      updateData.approved_by = user.id
      updateData.approved_at = new Date().toISOString()
    } else if (newStatus === 'rejected') {
      updateData.rejected_by = user.id
      updateData.rejected_at = new Date().toISOString()
      if (rejectionReason) {
        updateData.rejection_reason = rejectionReason
      }
    }

    const { data: loan, error } = await supabase
      .from('loans')
      .update(updateData)
      .eq('id', loanId)
      .select()
      .single()

    if (error) {
      console.error('[v0] Error updating loan status:', error)
      return null
    }

    // Log audit
    await createAuditLog('update', 'loans', loanId, null, {
      status: newStatus,
      approved_at: newStatus === 'approved' ? new Date().toISOString() : null,
      rejected_at: newStatus === 'rejected' ? new Date().toISOString() : null,
      rejection_reason: rejectionReason,
    })

    return loan
  } catch (error) {
    console.error('[v0] Error in updateLoanStatus:', error)
    return null
  }
}

/**
 * Get loan with related data
 */
export async function getLoanWithDetails(loanId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('loans')
    .select(`
      *,
      customer:customer_id (
        id,
        customer_code,
        first_name,
        last_name,
        document_number,
        status
      ),
      loan_guarantors (
        guarantor_customer_id,
        guarantor:guarantor_customer_id (id, first_name, last_name, customer_code)
      ),
      installments (
        id,
        installment_number,
        due_date,
        principal_amount,
        interest_amount,
        total_amount,
        paid_amount,
        status,
        paid_at
      )
    `)
    .eq('id', loanId)
    .single()

  if (error) {
    console.error('[v0] Error fetching loan:', error)
    return null
  }

  return data
}

/**
 * List all loans with filters
 */
export async function listLoans(
  customerId?: string,
  status?: string,
  limit: number = 50,
  offset: number = 0
) {
  const supabase = await createClient()

  let query = supabase
    .from('loans')
    .select(`
      id,
      loan_number,
      customer_id,
      principal_amount,
      interest_rate,
      total_amount,
      term_months,
      installment_amount,
      status,
      created_at,
      customer:customer_id (
        first_name,
        last_name,
        customer_code,
        document_number
      )
    `)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (customerId) {
    query = query.eq('customer_id', customerId)
  }

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error, count } = await query

  if (error) {
    console.error('[v0] Error listing loans:', error)
    return { loans: [], total: 0 }
  }

  return {
    loans: data || [],
    total: count || 0,
  }
}

/**
 * Get customer loan statistics
 */
export async function getCustomerLoanStats(customerId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('loans')
    .select('status, total_amount')
    .eq('customer_id', customerId)

  if (error) {
    return {
      activeLoans: 0,
      totalDebt: 0,
      completedLoans: 0,
      defaultedLoans: 0,
    }
  }

  const stats = {
    activeLoans: data?.filter((l) => l.status === 'active').length || 0,
    totalDebt: data?.filter((l) => l.status === 'active').reduce((sum, l) => sum + l.total_amount, 0) || 0,
    completedLoans: data?.filter((l) => l.status === 'completed').length || 0,
    defaultedLoans: data?.filter((l) => l.status === 'defaulted').length || 0,
  }

  return stats
}
