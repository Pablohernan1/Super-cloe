import { createClient } from '@/lib/supabase/server'
import type { Loan, Installment } from '@/lib/types'
import { calculateInstallments } from './interest-rates'
import { createAuditLog } from '@/lib/audit-logger'

/**
 * Create a new loan in the system
 */
export async function createLoan(
  customerId: string,
  principalAmount: number,
  interestRate: number,
  termMonths: number,
  purpose?: string
): Promise<{ loan: Loan; installments: Installment[] } | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    console.error('[v0] No authenticated user')
    return null
  }

  try {
    // Calculate total amount
    const totalAmount = principalAmount + principalAmount * interestRate
    const installmentAmount = totalAmount / termMonths

    // Generate loan number
    const loanNumber = `PRS-${Date.now()}`

    // Create loan
    const { data: loanData, error: loanError } = await supabase
      .from('loans')
      .insert({
        loan_number: loanNumber,
        customer_id: customerId,
        principal_amount: principalAmount,
        interest_rate: interestRate,
        total_amount: totalAmount,
        term_months: termMonths,
        installment_amount: installmentAmount,
        status: 'pending',
        purpose,
        created_by: user.id,
      })
      .select()
      .single()

    if (loanError || !loanData) {
      console.error('[v0] Error creating loan:', loanError)
      return null
    }

    console.log('[v0] Loan created:', loanData.id)

    // Create installments
    const firstDueDate = new Date()
    firstDueDate.setMonth(firstDueDate.getMonth() + 1)

    const installmentDetails = calculateInstallments(
      principalAmount,
      totalAmount,
      termMonths,
      firstDueDate
    )

    const { data: installmentsData, error: installmentsError } = await supabase
      .from('installments')
      .insert(
        installmentDetails.map((inst) => ({
          ...inst,
          loan_id: loanData.id,
          status: 'pending',
        }))
      )
      .select()

    if (installmentsError) {
      console.error('[v0] Error creating installments:', installmentsError)
      // TODO: Rollback loan creation
      return null
    }

    console.log('[v0] Installments created:', installmentsData?.length)

    // Log audit
    await createAuditLog('create', 'loans', loanData.id, null, {
      customer_id: customerId,
      principal_amount: principalAmount,
      interest_rate: interestRate,
      term_months: termMonths,
      total_amount: totalAmount,
      status: 'pending',
    })

    return {
      loan: loanData,
      installments: installmentsData || [],
    }
  } catch (error) {
    console.error('[v0] Error in createLoan:', error)
    return null
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
        is_active
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
 * Approve loan and update credit limit commitment
 */
export async function approveLoan(loanId: string, approvedBy: string): Promise<Loan | null> {
  const supabase = await createClient()

  try {
    // Fetch loan details
    const { data: loan } = await supabase
      .from('loans')
      .select('id, customer_id, total_amount, status')
      .eq('id', loanId)
      .single()

    if (!loan || loan.status !== 'pending') {
      console.error('[v0] Loan not in pending status')
      return null
    }

    // Update loan status to approved
    const { data: updatedLoan, error: loanError } = await supabase
      .from('loans')
      .update({
        status: 'approved',
        approved_by: approvedBy,
        approved_at: new Date().toISOString(),
        updated_by: approvedBy,
      })
      .eq('id', loanId)
      .select()
      .single()

    if (loanError) {
      console.error('[v0] Error approving loan:', loanError)
      return null
    }

    // Update credit limit - increase committed_limit
    const { data: creditLimit } = await supabase
      .from('credit_limits')
      .select('id, approved_limit, committed_limit, available_credit')
      .eq('customer_id', loan.customer_id)
      .single()

    if (creditLimit) {
      const newCommitted = (creditLimit.committed_limit || 0) + loan.total_amount
      const newAvailable = creditLimit.approved_limit - newCommitted

      const { error: updateError } = await supabase
        .from('credit_limits')
        .update({
          committed_limit: newCommitted,
          available_credit: Math.max(0, newAvailable),
          updated_by: approvedBy,
        })
        .eq('id', creditLimit.id)

      if (updateError) {
        console.error('[v0] Error updating credit limit:', updateError)
      } else {
        console.log('[v0] Credit limit updated:', { newCommitted, newAvailable })
      }
    }

    // Log audit
    await createAuditLog('approve', 'loans', loanId, null, {
      status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: approvedBy,
    })

    return updatedLoan
  } catch (error) {
    console.error('[v0] Error in approveLoan:', error)
    return null
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
