import { createClient } from '@/lib/supabase/server'

export interface LoanCalculation {
  principalAmount: number
  monthlyRate: number
  totalInterest: number
  totalAmount: number
  monthlyPayment: number
  interestAccumulated: number[]
}

const RATE_PARAM_BY_TERM: Record<number, string> = {
  1: 'interest_rate_1_installment',
  2: 'interest_rate_2_installments',
  3: 'interest_rate_3_installments',
}

const DEFAULT_RATES: Record<number, number> = {
  1: 0.15,
  2: 0.25,
  3: 0.30,
}

async function getParameterNumeric(key: string, fallback: number): Promise<number> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('parameters')
    .select('value')
    .eq('key', key)
    .eq('is_active', true)
    .single()

  if (data?.value) {
    const parsed = parseFloat(data.value)
    if (!Number.isNaN(parsed)) return parsed
  }

  return fallback
}

/**
 * Tasa directa según spec 8.4/9: 1 cuota 15%, 2 cuotas 25%, 3 cuotas 30%,
 * parametrizable desde la tabla `parameters`. Sin interpolación: el plazo
 * máximo lo define el parámetro `max_installments`.
 */
export async function getInterestRate(termMonths: number): Promise<number> {
  const paramKey = RATE_PARAM_BY_TERM[termMonths]

  if (!paramKey) {
    // Fuera de 1-3 cuotas: usar la tasa del máximo plazo soportado
    return getParameterNumeric('interest_rate_3_installments', DEFAULT_RATES[3])
  }

  return getParameterNumeric(paramKey, DEFAULT_RATES[termMonths])
}

export async function getMaxInstallments(): Promise<number> {
  return getParameterNumeric('max_installments', 3)
}

/**
 * Calcula interés total, total a cobrar y valor de cuota con tasa directa
 * simple (spec 9): interés total = capital × tasa; total a cobrar = capital
 * + interés total; valor cuota = total a cobrar / cantidad de cuotas.
 */
export async function calculateLoanPayment(
  principalAmount: number,
  termMonths: number
): Promise<LoanCalculation> {
  const monthlyRate = await getInterestRate(termMonths)
  const totalInterest = Math.round(principalAmount * monthlyRate * 100) / 100
  const totalAmount = Math.round((principalAmount + totalInterest) * 100) / 100
  const monthlyPayment = Math.round((totalAmount / termMonths) * 100) / 100

  const interestAccumulated: number[] = []
  const interestPerInstallment = Math.round((totalInterest / termMonths) * 100) / 100
  for (let i = 0; i < termMonths; i++) {
    interestAccumulated.push(interestPerInstallment)
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
 * Calendario de cuotas para vista previa (simulación). La creación real del
 * préstamo recalcula esto mismo dentro de la función Postgres `create_loan`,
 * que es la fuente de verdad -- esto es solo para mostrarlo antes de confirmar.
 */
export function calculateInstallments(
  principalAmount: number,
  totalAmount: number,
  termMonths: number,
  firstDueDate: Date
) {
  const installmentBase = Math.round((totalAmount / termMonths) * 100) / 100
  const remainder = Math.round((totalAmount - installmentBase * termMonths) * 100) / 100
  const principalPerInstallment = Math.round((principalAmount / termMonths) * 100) / 100

  const installments = []

  for (let i = 1; i <= termMonths; i++) {
    const dueDate = new Date(firstDueDate)
    dueDate.setMonth(dueDate.getMonth() + i - 1)

    const totalForInstallment = i === termMonths ? installmentBase + remainder : installmentBase

    installments.push({
      installment_number: i,
      due_date: dueDate.toISOString().split('T')[0],
      principal_amount: principalPerInstallment,
      interest_amount: Math.round((totalForInstallment - principalPerInstallment) * 100) / 100,
      total_amount: totalForInstallment,
    })
  }

  return installments
}
