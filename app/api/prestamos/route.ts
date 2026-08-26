import { createClient } from '@/lib/supabase/server'
import { validateLoanEligibility } from '@/lib/services/loan-validator'
import { createLoan } from '@/lib/services/loan-service'
import { calculateLoanPayment } from '@/lib/services/interest-rates'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const canCreateLoan = ['supervisor', 'administrador'].includes(userProfile?.role || '')
    if (!canCreateLoan) {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { customer_id, principal_amount, term_months, purpose } = await request.json()

    // Validate required fields
    if (!customer_id || !principal_amount || !term_months) {
      return Response.json(
        { error: 'Missing required fields: customer_id, principal_amount, term_months' },
        { status: 400 }
      )
    }

    console.log('[v0] Creating loan:', { customer_id, principal_amount, term_months })

    // Validate eligibility
    const validation = await validateLoanEligibility(customer_id, principal_amount, term_months)

    if (!validation.isValid) {
      console.log('[v0] Loan validation failed:', validation.errors)
      return Response.json(
        {
          error: 'Loan validation failed',
          errors: validation.errors,
          warnings: validation.warnings,
        },
        { status: 400 }
      )
    }

    // Calculate interest (preview -- create_loan recalcula la fuente de verdad en la DB)
    const calculation = await calculateLoanPayment(principal_amount, term_months)

    // Create loan (atómico, con garantes del titular y validaciones críticas en la DB)
    const result = await createLoan(customer_id, principal_amount, term_months, purpose)

    if (!result.success) {
      return Response.json({ error: result.error || 'Failed to create loan' }, { status: 400 })
    }

    console.log('[v0] Loan created successfully:', result.loan.id)

    return Response.json({
      success: true,
      loan: result.loan,
      installments: result.installments,
      calculation,
    })
  } catch (error) {
    console.error('[v0] Error in POST /api/prestamos:', error)
    return Response.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const customerId = searchParams.get('customer_id')
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    const { data: loans, error } = await supabase
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
      .eq(customerId ? 'customer_id' : 'id', customerId || '')
      .eq(status ? 'status' : 'id', status || '')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('[v0] Error fetching loans:', error)
      return Response.json({ error: 'Failed to fetch loans' }, { status: 500 })
    }

    return Response.json({
      success: true,
      loans: loans || [],
      count: loans?.length || 0,
    })
  } catch (error) {
    console.error('[v0] Error in GET /api/prestamos:', error)
    return Response.json({ error: 'Server error' }, { status: 500 })
  }
}
