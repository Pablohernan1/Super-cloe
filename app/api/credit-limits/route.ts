import { createClient } from '@/lib/supabase/server'
import { createAuditLog } from '@/lib/audit-logger'
import { canApprove, canCreate } from '@/lib/permissions'

export async function POST(request: Request) {
  try {
    const { customer_id, approved_limit, observations } = await request.json()
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check user permissions
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!canCreate(userProfile?.role)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Check if customer already has a credit limit
    const { data: existing } = await supabase
      .from('credit_limits')
      .select('id')
      .eq('customer_id', customer_id)
      .single()

    if (existing) {
      return Response.json({ error: 'Este cliente ya tiene un límite de crédito' }, { status: 400 })
    }

    // Count active guarantors
    const { data: guarantors } = await supabase
      .from('guarantor_relations')
      .select('id')
      .eq('titular_customer_id', customer_id)
      .eq('status', 'active')

    const guarantorsCount = guarantors?.length || 0
    const guarantorsRequired = guarantorsCount >= 2 ? 2 : 1

    // Create the credit limit
    const { data: newLimit, error } = await supabase
      .from('credit_limits')
      .insert({
        customer_id,
        approved_limit,
        committed_limit: 0,
        available_credit: approved_limit,
        status: 'pending_approval',
        observations,
        guarantors_required: guarantorsRequired,
        guarantors_active_count: guarantorsCount,
        eligible_for_extension: guarantorsCount >= 2,
        created_by: user.id,
      })
      .select()
      .single()

    if (error) {
      return Response.json({ error: error.message }, { status: 400 })
    }

    // Log audit
    await createAuditLog('create', 'credit_limits', newLimit.id, null, {
      customer_id,
      approved_limit,
      status: 'pending_approval',
    })

    return Response.json(newLimit)
  } catch (err) {
    console.error('[v0] Error in POST /api/credit-limits:', err)
    return Response.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const url = new URL(request.url)
    const id = url.pathname.split('/').pop()
    
    const { action } = await request.json()
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check user permissions
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    // Aprobar/rechazar límites queda restringido a supervisor+ (spec 4, 8.6)
    if (!canApprove(userProfile?.role)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }

    const now = new Date().toISOString()

    if (action === 'approve') {
      const { data: creditLimit, error: fetchError } = await supabase
        .from('credit_limits')
        .select('*')
        .eq('id', id)
        .single()

      if (fetchError || !creditLimit) {
        return Response.json({ error: 'Credit limit not found' }, { status: 404 })
      }

      const { error } = await supabase
        .from('credit_limits')
        .update({
          status: 'approved',
          approved_by: user.id,
          approved_at: now,
          updated_by: user.id,
          updated_at: now,
        })
        .eq('id', id)

      if (error) {
        return Response.json({ error: error.message }, { status: 400 })
      }

      await createAuditLog('approve', 'credit_limits', id, creditLimit, {
        status: 'approved',
      })

      return Response.json({ success: true, status: 'approved' })
    }

    if (action === 'reject') {
      const { data: creditLimit, error: fetchError } = await supabase
        .from('credit_limits')
        .select('*')
        .eq('id', id)
        .single()

      if (fetchError || !creditLimit) {
        return Response.json({ error: 'Credit limit not found' }, { status: 404 })
      }

      const { error } = await supabase
        .from('credit_limits')
        .update({
          status: 'rejected',
          updated_by: user.id,
          updated_at: now,
        })
        .eq('id', id)

      if (error) {
        return Response.json({ error: error.message }, { status: 400 })
      }

      await createAuditLog('reject', 'credit_limits', id, creditLimit, {
        status: 'rejected',
      })

      return Response.json({ success: true, status: 'rejected' })
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err) {
    console.error('[v0] Error in PATCH /api/credit-limits:', err)
    return Response.json({ error: 'Server error' }, { status: 500 })
  }
}
