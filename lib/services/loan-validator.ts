import { createClient } from '@/lib/supabase/server'
import type { Customer, CreditLimit } from '@/lib/types'
import { getMaxInstallments } from './interest-rates'

export interface LoanValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  customer?: Customer
  creditLimit?: CreditLimit
  activeGuarantors?: number
}

/**
 * Validate if a customer is eligible to obtain a loan
 */
export async function validateLoanEligibility(
  customerId: string,
  loanAmount: number,
  termMonths: number
): Promise<LoanValidationResult> {
  const supabase = await createClient()
  const errors: string[] = []
  const warnings: string[] = []

  try {
    // 1. Fetch customer
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .single()

    if (customerError || !customer) {
      return {
        isValid: false,
        errors: ['Cliente no encontrado'],
        warnings: [],
      }
    }

    // 2. Check if customer is active
    if (customer.status !== 'active') {
      errors.push(`Cliente no habilitado para operar (estado: ${customer.status})`)
    }

    // 3. Fetch credit limit
    const { data: creditLimit } = await supabase
      .from('credit_limits')
      .select('*')
      .eq('customer_id', customerId)
      .single()

    if (!creditLimit) {
      errors.push('Cliente no tiene límite de crédito asignado')
    } else {
      // 4. Check credit limit status
      if (creditLimit.status !== 'approved') {
        errors.push(`Límite de crédito en estado: ${creditLimit.status}`)
      }

      // 5. Check available credit
      if (loanAmount > creditLimit.available_credit) {
        errors.push(
          `Monto solicitado ($${loanAmount.toLocaleString('es-AR')}) excede crédito disponible ($${creditLimit.available_credit.toLocaleString('es-AR')})`
        )
      }

      // 6. Check if eligible for extension
      if (!creditLimit.eligible_for_extension && loanAmount > creditLimit.available_credit * 0.5) {
        warnings.push('Cliente no es elegible para ampliación de crédito')
      }

      // 7. Check guarantors
      if (creditLimit.guarantors_active_count < creditLimit.guarantors_required) {
        errors.push(
          `Insuficientes garantes activos: ${creditLimit.guarantors_active_count} de ${creditLimit.guarantors_required} requeridos`
        )
      }
    }

    // 8. Validate loan parameters
    if (loanAmount <= 0) {
      errors.push('Monto debe ser mayor a 0')
    }

    const maxInstallments = await getMaxInstallments()
    if (termMonths < 1 || termMonths > maxInstallments) {
      errors.push(`Cantidad de cuotas debe estar entre 1 y ${maxInstallments}`)
    }

    // 9. Fetch active guarantors
    const { data: guarantors } = await supabase
      .from('guarantor_relations')
      .select('id')
      .eq('titular_customer_id', customerId)
      .eq('status', 'active')

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      customer,
      creditLimit,
      activeGuarantors: guarantors?.length || 0,
    }
  } catch (error) {
    console.error('[v0] Error validating loan eligibility:', error)
    return {
      isValid: false,
      errors: ['Error en validación de préstamo'],
      warnings: [],
    }
  }
}

/**
 * Check if customer can request a loan increase
 */
export async function canRequestLoanIncrease(customerId: string): Promise<boolean> {
  const supabase = await createClient()

  const { data: creditLimit } = await supabase
    .from('credit_limits')
    .select('eligible_for_extension')
    .eq('customer_id', customerId)
    .single()

  return creditLimit?.eligible_for_extension ?? false
}
