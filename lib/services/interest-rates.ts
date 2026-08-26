import { createClient } from '@/lib/supabase/server'

export interface InterestRate {
  termMonths: number
  monthlyRate: number
  totalRate: number
}

export interface LoanCalculation {
  principalAmount: number
  monthlyRate: number
  totalInterest: number
  totalAmount: number
  monthlyPayment: number
  interestAccumulated: number[]
}

/**
 * Predefined interest rates by term
 * This is a simple implementation. Future: can be replaced with table from database
 */
const DEFAULT_RATES: Record<number, number> = {
  1: 0.025, // 2.5% for 1 month
  2: 0.045, // 4.5% for 2 months
  3: 0.065, // 6.5% for 3 months
  6: 0.09, // 9% for 6 months
  12: 0.12, // 12% for 12 months
  24: 0.14, // 14% for 24 months
  36: 0.15, // 15% for 36 months
}

/**
 * Get interest rate for a given term
 * Uses linear interpolation for non-standard terms
 */
export async function getInterestRate(termMonths: number): Promise<number> {
  // Try to get from database first (future feature)
  const supabase = await createClient()

  try {
    const { data: parameter } = await supabase
      .from('parameters')
      .select('value')
      .eq('key', `INTEREST_RATE_${termMonths}M`)
      .eq('is_active', true)
      .single()

    if (parameter) {
      return parseFloat(parameter.value)
    }
  } catch (error) {
    console.log('[v0] Interest rate not found in parameters, using defaults')
  }

  // Fall back to defaults
  if (DEFAULT_RATES[termMonths]) {
    return DEFAULT_RATES[termMonths]
  }

  // Linear interpolation for non-standard terms
  const sortedTerms = Object.keys(DEFAULT_RATES)
    .map(Number)
    .sort((a, b) => a - b)

  let lowerTerm = sortedTerms[0]
  let upperTerm = sortedTerms[sortedTerms.length - 1]

  for (let i = 0; i < sortedTerms.length - 1; i++) {
    if (sortedTerms[i] <= termMonths && termMonths <= sortedTerms[i + 1]) {
      lowerTerm = sortedTerms[i]
      upperTerm = sortedTerms[i + 1]
      break
    }
  }

  const lowerRate = DEFAULT_RATES[lowerTerm]
  const upperRate = DEFAULT_RATES[upperTerm]
  const ratio = (termMonths - lowerTerm) / (upperTerm - lowerTerm)

  return lowerRate + ratio * (upperRate - lowerRate)
}

/**
 * Calculate loan payments with interest
 * Uses simple interest formula for now
 */
export async function calculateLoanPayment(
  principalAmount: number,
  termMonths: number
): Promise<LoanCalculation> {
  const monthlyRate = await getInterestRate(termMonths)
  const totalRate = monthlyRate
  const totalInterest = principalAmount * totalRate
  const totalAmount = principalAmount + totalInterest
  const monthlyPayment = totalAmount / termMonths

  // Calculate interest accumulated per month (for installments)
  const interestAccumulated: number[] = []
  let accumulated = 0

  for (let i = 0; i < termMonths; i++) {
    const monthlyInterest = totalInterest / termMonths
    accumulated += monthlyInterest
    interestAccumulated.push(monthlyInterest)
  }

  return {
    principalAmount,
    monthlyRate,
    totalInterest,
    totalAmount,
    monthlyPayment,
    interestAccumulated,
  }
}

/**
 * Calculate all installment details
 */
export function calculateInstallments(
  principalAmount: number,
  totalAmount: number,
  termMonths: number,
  firstDueDate: Date
) {
  const interestTotal = totalAmount - principalAmount
  const interestPerMonth = interestTotal / termMonths
  const principalPerMonth = principalAmount / termMonths

  const installments = []

  for (let i = 1; i <= termMonths; i++) {
    const dueDate = new Date(firstDueDate)
    dueDate.setMonth(dueDate.getMonth() + i - 1)

    installments.push({
      installment_number: i,
      due_date: dueDate.toISOString().split('T')[0],
      principal_amount: principalPerMonth,
      interest_amount: interestPerMonth,
      total_amount: principalPerMonth + interestPerMonth,
    })
  }

  return installments
}
