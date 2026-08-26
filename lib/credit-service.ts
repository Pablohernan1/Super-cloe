import { SupabaseClient } from '@supabase/supabase-js'
import type { CreditLimit } from '@/lib/types'

/**
 * Credit service for managing credit limits and availability
 * Used by loans module to reserve and release credit
 */

/**
 * Calculate available credit for a limit
 * Available = Approved - Committed
 */
export function calculateAvailable(limit: CreditLimit): number {
  return Math.max(0, limit.approved_limit - limit.committed_limit)
}

/**
 * Check if a loan amount can be covered by available credit
 * Returns { allowed: boolean, available: number, needed: number }
 */
export function validateLoanAmount(
  limit: CreditLimit,
  amount: number
): { allowed: boolean; available: number; needed: number } {
  const available = calculateAvailable(limit)
  const needed = Math.max(0, amount - available)

  return {
    allowed: amount <= limit.approved_limit && available >= amount,
    available,
    needed,
  }
}

/**
 * Reserve credit for a new loan
 * Updates committed_limit and available_credit
 */
export async function reserveCredit(
  supabase: SupabaseClient,
  limitId: string,
  amount: number,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get current limit
    const { data: limit, error: fetchError } = await supabase
      .from('credit_limits')
      .select('committed_limit, available_credit, approved_limit')
      .eq('id', limitId)
      .single()

    if (fetchError || !limit) {
      return { success: false, error: 'Credit limit not found' }
    }

    // Validate amount
    const available = limit.approved_limit - limit.committed_limit
    if (amount > available) {
      return {
        success: false,
        error: `Insufficient credit. Available: $${available.toLocaleString('es-AR')}`,
      }
    }

    // Update limit
    const newCommitted = limit.committed_limit + amount
    const newAvailable = limit.approved_limit - newCommitted

    const { error: updateError } = await supabase
      .from('credit_limits')
      .update({
        committed_limit: newCommitted,
        available_credit: newAvailable,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', limitId)

    if (updateError) {
      return { success: false, error: updateError.message }
    }

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Release reserved credit when a loan is cancelled or paid
 * Reduces committed_limit and updates available_credit
 */
export async function releaseCredit(
  supabase: SupabaseClient,
  limitId: string,
  amount: number,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get current limit
    const { data: limit, error: fetchError } = await supabase
      .from('credit_limits')
      .select('committed_limit, approved_limit')
      .eq('id', limitId)
      .single()

    if (fetchError || !limit) {
      return { success: false, error: 'Credit limit not found' }
    }

    // Validate release amount
    if (amount > limit.committed_limit) {
      return {
        success: false,
        error: `Cannot release more than committed. Committed: $${limit.committed_limit.toLocaleString('es-AR')}`,
      }
    }

    // Update limit
    const newCommitted = Math.max(0, limit.committed_limit - amount)
    const newAvailable = limit.approved_limit - newCommitted

    const { error: updateError } = await supabase
      .from('credit_limits')
      .update({
        committed_limit: newCommitted,
        available_credit: newAvailable,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', limitId)

    if (updateError) {
      return { success: false, error: updateError.message }
    }

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Get credit limit for a customer
 */
export async function getCreditLimit(
  supabase: SupabaseClient,
  customerId: string
): Promise<CreditLimit | null> {
  const { data } = await supabase
    .from('credit_limits')
    .select('*')
    .eq('customer_id', customerId)
    .eq('status', 'approved')
    .single()

  return data as CreditLimit | null
}

/**
 * Check if customer has active guarantors (requirement for credit)
 */
export async function checkGuarantorRequirement(
  supabase: SupabaseClient,
  customerId: string
): Promise<{ met: boolean; active: number; required: number }> {
  const { data: guarantors } = await supabase
    .from('guarantor_relations')
    .select('id')
    .eq('titular_customer_id', customerId)
    .eq('status', 'active')

  const active = guarantors?.length || 0
  const required = active >= 2 ? 2 : active >= 1 ? 1 : 0

  return {
    met: active >= 1,
    active,
    required,
  }
}
