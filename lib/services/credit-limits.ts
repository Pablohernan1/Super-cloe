import { createClient } from '@/lib/supabase/server'
import type { CreditLimit } from '@/lib/types'

/**
 * Credit limit validation context for loans
 */
export interface CreditLimitValidationContext {
  creditLimit: CreditLimit
  activeLoansAmount: number
  availableForLoan: number
  isEligible: boolean
  guarantorsOk: boolean
  errorMessage?: string
}

/**
 * Validate if a customer can get a loan based on their credit limit
 */
export async function validateCreditLimitForLoan(
  customerId: string,
  loanAmount: number
): Promise<CreditLimitValidationContext | null> {
  const supabase = await createClient()

  try {
    // Fetch credit limit
    const { data: creditLimit, error: limitError } = await supabase
      .from('credit_limits')
      .select('*')
      .eq('customer_id', customerId)
      .single()

    if (limitError || !creditLimit) {
      return null
    }

    // If not approved, cannot create loan
    if (creditLimit.status !== 'approved') {
      return {
        creditLimit,
        activeLoansAmount: 0,
        availableForLoan: 0,
        isEligible: false,
        guarantorsOk: false,
        errorMessage: 'El límite de crédito no está aprobado',
      }
    }

    // Fetch active loans to see how much is committed
    const { data: activeLoans } = await supabase
      .from('loans')
      .select('total_amount')
      .eq('customer_id', customerId)
      .in('status', ['active', 'approved'])

    const activeLoansAmount = activeLoans?.reduce((sum, l) => sum + (l.total_amount || 0), 0) || 0

    // Calculate available credit
    const committed = creditLimit.committed_limit || 0
    const available = creditLimit.available_credit || 0
    const realAvailable = Math.min(available, creditLimit.approved_limit - activeLoansAmount)

    // Check if loan amount fits
    const canFitLoan = realAvailable >= loanAmount
    const hasEnoughGuarantors = creditLimit.guarantors_active_count >= creditLimit.guarantors_required

    let errorMessage = undefined
    if (!canFitLoan) {
      errorMessage = `Crédito insuficiente. Disponible: $${realAvailable.toLocaleString('es-AR')}, solicitado: $${loanAmount.toLocaleString('es-AR')}`
    }
    if (!hasEnoughGuarantors) {
      errorMessage = `Faltan ${creditLimit.guarantors_required - creditLimit.guarantors_active_count} garante(s)`
    }

    return {
      creditLimit,
      activeLoansAmount,
      availableForLoan: realAvailable,
      isEligible: canFitLoan && hasEnoughGuarantors,
      guarantorsOk: hasEnoughGuarantors,
      errorMessage,
    }
  } catch (err) {
    console.error('[v0] Error validating credit limit:', err)
    return null
  }
}

/**
 * Get all loans associated with a credit limit
 */
export async function getLoansForCreditLimit(creditLimitId: string) {
  const supabase = await createClient()

  try {
    const { data: creditLimit } = await supabase
      .from('credit_limits')
      .select('customer_id')
      .eq('id', creditLimitId)
      .single()

    if (!creditLimit) return []

    const { data: loans } = await supabase
      .from('loans')
      .select(`
        id,
        loan_number,
        principal_amount,
        total_amount,
        status,
        disbursement_date,
        created_at
      `)
      .eq('customer_id', creditLimit.customer_id)
      .in('status', ['active', 'approved', 'pending'])
      .order('created_at', { ascending: false })

    return loans || []
  } catch (err) {
    console.error('[v0] Error fetching loans:', err)
    return []
  }
}

/**
 * Calculate credit utilization percentage
 */
export function calculateUtilizationPercentage(creditLimit: CreditLimit): number {
  if (creditLimit.approved_limit === 0) return 0
  return Math.round((creditLimit.committed_limit / creditLimit.approved_limit) * 100)
}
