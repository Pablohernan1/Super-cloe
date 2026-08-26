import { supabase } from './supabase'

const RATE_PARAM_BY_TERM: Record<number, string> = {
  1: 'interest_rate_1_installment',
  2: 'interest_rate_2_installments',
  3: 'interest_rate_3_installments',
}

const DEFAULT_RATES: Record<number, number> = { 1: 0.15, 2: 0.25, 3: 0.3 }

async function getParameterNumeric(key: string, fallback: number): Promise<number> {
  const { data } = await supabase.from('parameters').select('value').eq('key', key).eq('is_active', true).single()
  if (data?.value) {
    const parsed = parseFloat(data.value)
    if (!Number.isNaN(parsed)) return parsed
  }
  return fallback
}

export async function getInterestRate(termMonths: number): Promise<number> {
  const paramKey = RATE_PARAM_BY_TERM[termMonths]
  if (!paramKey) return getParameterNumeric('interest_rate_3_installments', DEFAULT_RATES[3])
  return getParameterNumeric(paramKey, DEFAULT_RATES[termMonths])
}

export async function getMaxInstallments(): Promise<number> {
  return getParameterNumeric('max_installments', 3)
}

export interface LoanCalculation {
  principalAmount: number
  monthlyRate: number
  totalInterest: number
  totalAmount: number
  monthlyPayment: number
}

// Preview client-side: la fuente de verdad real es la funcion Postgres
// `create_loan`, que recalcula todo esto de nuevo al confirmar.
export async function calculateLoanPayment(principalAmount: number, termMonths: number): Promise<LoanCalculation> {
  const monthlyRate = await getInterestRate(termMonths)
  const totalInterest = Math.round(principalAmount * monthlyRate * 100) / 100
  const totalAmount = Math.round((principalAmount + totalInterest) * 100) / 100
  const monthlyPayment = Math.round((totalAmount / termMonths) * 100) / 100

  return { principalAmount, monthlyRate, totalInterest, totalAmount, monthlyPayment }
}
