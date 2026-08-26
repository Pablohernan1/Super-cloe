import { createClient } from '@/lib/supabase/server'
import { validateLoanEligibility } from '@/lib/services/loan-validator'
import { calculateLoanPayment } from '@/lib/services/interest-rates'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: customerId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { principal_amount, term_months } = await request.json()

    if (!principal_amount || !term_months) {
      return Response.json(
        { error: 'Missing required fields: principal_amount, term_months' },
        { status: 400 }
      )
    }

    console.log('[v0] Validating loan eligibility:', { customerId, principal_amount, term_months })

    // Validate eligibility
    const validation = await validateLoanEligibility(customerId, principal_amount, term_months)

    if (!validation.isValid) {
      console.log('[v0] Loan validation failed:', validation.errors)
      return Response.json(
        {
          isValid: false,
          errors: validation.errors,
          warnings: validation.warnings,
          customer: validation.customer,
          creditLimit: validation.creditLimit,
          activeGuarantors: validation.activeGuarantors,
        },
        { status: 400 }
      )
    }

    // Calculate payment
    const calculation = await calculateLoanPayment(principal_amount, term_months)

    console.log('[v0] Loan validation successful')

    return Response.json({
      isValid: true,
      errors: [],
      warnings: validation.warnings,
      customer: validation.customer,
      creditLimit: validation.creditLimit,
      activeGuarantors: validation.activeGuarantors,
      calculation,
    })
  } catch (error) {
    console.error('[v0] Error in POST /api/prestamos/[id]/validate:', error)
    return Response.json({ error: 'Server error' }, { status: 500 })
  }
}
