'use server'

import { supabaseAdmin } from '@/lib/supabase-admin'

export interface PortalData {
  customer: {
    firstName: string
    lastName: string
    status: 'active' | 'inactive' | 'blocked' | 'suspended'
  }
  creditLimit: {
    approvedLimit: number
    availableCredit: number
  } | null
  loans: Array<{
    id: string
    loanNumber: string
    principalAmount: number
    interestRate: number
    totalAmount: number
    termMonths: number
    status: string
    balance: number
    installments: Array<{
      number: number
      dueDate: string
      totalAmount: number
      paidAmount: number
      status: string
    }>
  }>
  payments: Array<{
    paymentNumber: string
    amount: number
    receivedAt: string
    loanNumber: string
  }>
}

export interface VerifyResult {
  success: boolean
  error?: string
  data?: PortalData
}

// Segundo factor: últimos 4 caracteres del documento (DNI/CUIT/CUIL), para
// que una tarjeta perdida o fotografiada no alcance sola para ver la
// deuda de otra persona. No distingue "token inexistente" de "documento
// incorrecto" en el mensaje de error, para no filtrar si un token es
// válido a quien esté probando al azar.
export async function verifyAndFetchPortalData(token: string, last4: string): Promise<VerifyResult> {
  const cleanLast4 = last4.trim()
  if (!token || cleanLast4.length < 4) {
    return { success: false, error: 'Completá los últimos 4 dígitos de tu documento.' }
  }

  const { data: customer, error: customerError } = await supabaseAdmin
    .from('customers')
    .select('id, first_name, last_name, status, document_number, cuit_cuil')
    .eq('portal_token', token)
    .maybeSingle()

  if (customerError || !customer) {
    return { success: false, error: 'No pudimos verificar tus datos. Revisá el código e intentá de nuevo.' }
  }

  const docLast4 = (customer.document_number || '').replace(/\D/g, '').slice(-4)
  const cuitLast4 = (customer.cuit_cuil || '').replace(/\D/g, '').slice(-4)

  if (cleanLast4 !== docLast4 && cleanLast4 !== cuitLast4) {
    return { success: false, error: 'No pudimos verificar tus datos. Revisá el código e intentá de nuevo.' }
  }

  const [{ data: creditLimit }, { data: loans }] = await Promise.all([
    supabaseAdmin
      .from('credit_limits')
      .select('approved_limit, available_credit')
      .eq('customer_id', customer.id)
      .maybeSingle(),
    supabaseAdmin
      .from('loans')
      .select(`
        id, loan_number, principal_amount, interest_rate, total_amount, term_months, status,
        installments ( installment_number, due_date, total_amount, paid_amount, status,
          payments ( payment_number, amount, received_at )
        )
      `)
      .eq('customer_id', customer.id)
      .order('created_at', { ascending: false }),
  ])

  const allPayments: PortalData['payments'] = []
  const loanData: PortalData['loans'] = (loans || []).map((loan: any) => {
    const installments = (loan.installments || []).sort(
      (a: any, b: any) => a.installment_number - b.installment_number
    )
    const balance = installments.reduce(
      (sum: number, inst: any) => sum + (inst.total_amount - inst.paid_amount),
      0
    )

    for (const inst of installments) {
      for (const p of inst.payments || []) {
        allPayments.push({
          paymentNumber: p.payment_number,
          amount: p.amount,
          receivedAt: p.received_at,
          loanNumber: loan.loan_number,
        })
      }
    }

    return {
      id: loan.id,
      loanNumber: loan.loan_number,
      principalAmount: loan.principal_amount,
      interestRate: loan.interest_rate,
      totalAmount: loan.total_amount,
      termMonths: loan.term_months,
      status: loan.status,
      balance,
      installments: installments.map((inst: any) => ({
        number: inst.installment_number,
        dueDate: inst.due_date,
        totalAmount: inst.total_amount,
        paidAmount: inst.paid_amount,
        status: inst.status,
      })),
    }
  })

  allPayments.sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime())

  return {
    success: true,
    data: {
      customer: {
        firstName: customer.first_name,
        lastName: customer.last_name,
        status: customer.status,
      },
      creditLimit: creditLimit
        ? { approvedLimit: creditLimit.approved_limit, availableCredit: creditLimit.available_credit }
        : null,
      loans: loanData,
      payments: allPayments,
    },
  }
}
