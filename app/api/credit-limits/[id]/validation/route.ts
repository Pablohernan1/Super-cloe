import { createClient } from '@/lib/supabase/server'
import { validateCreditLimitForLoan } from '@/lib/services/credit-limits'

/**
 * GET /api/credit-limits/[id]/validation
 * Validates if a customer can get a loan based on their credit limit
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const url = new URL(request.url)
    const loanAmount = url.searchParams.get('loan_amount')

    if (!loanAmount) {
      return Response.json({ error: 'Missing loan_amount parameter' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get credit limit to find customer_id
    const { data: creditLimit } = await supabase
      .from('credit_limits')
      .select('customer_id')
      .eq('id', id)
      .single()

    if (!creditLimit) {
      return Response.json({ error: 'Credit limit not found' }, { status: 404 })
    }

    // Validate
    const validation = await validateCreditLimitForLoan(
      creditLimit.customer_id,
      parseFloat(loanAmount)
    )

    if (!validation) {
      return Response.json({ error: 'Validation failed' }, { status: 400 })
    }

    return Response.json(validation)
  } catch (err) {
    console.error('[v0] Error in validation endpoint:', err)
    return Response.json({ error: 'Server error' }, { status: 500 })
  }
}
