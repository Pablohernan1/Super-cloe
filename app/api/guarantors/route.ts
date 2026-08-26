import { createClient } from '@/lib/supabase/server'
import { createAuditLog } from '@/lib/audit-logger'
import { canUpdate } from '@/lib/permissions'

export async function POST(request: Request) {
  const { titular_id, guarantor_id, action, relation_id } = await request.json()
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

  if (!canUpdate(userProfile?.role)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Validate guarantor status if creating new relation
  if (action === 'create') {
    const { data: guarantor } = await supabase
      .from('customers')
      .select('status')
      .eq('id', guarantor_id)
      .single()

    if (!guarantor || guarantor.status !== 'active') {
      return Response.json(
        { error: `Guarantor cannot be ${guarantor?.status || 'not found'}: only active customers can be guarantors` },
        { status: 400 }
      )
    }

    // Check for duplicates
    const { data: existing } = await supabase
      .from('guarantor_relations')
      .select('id')
      .eq('titular_customer_id', titular_id)
      .eq('guarantor_customer_id', guarantor_id)
      .single()

    if (existing) {
      return Response.json({ error: 'This guarantor relationship already exists' }, { status: 400 })
    }

    // Create the relation
    const { data: newRelation, error } = await supabase
      .from('guarantor_relations')
      .insert({
        titular_customer_id: titular_id,
        guarantor_customer_id: guarantor_id,
        status: 'active',
        created_by: user.id,
      })
      .select()
      .single()

    if (error) {
      return Response.json({ error: error.message }, { status: 400 })
    }

    // Log audit
    await createAuditLog('create', 'guarantor_relations', newRelation.id, null, {
      titular_customer_id: titular_id,
      guarantor_customer_id: guarantor_id,
    })

    return Response.json(newRelation)
  }

  // Update relation status (inactivate/reactivate)
  if (action === 'update' && relation_id) {
    const { data: relation } = await supabase
      .from('guarantor_relations')
      .select('status')
      .eq('id', relation_id)
      .single()

    const newStatus = relation?.status === 'active' ? 'inactive' : 'active'

    const { error } = await supabase
      .from('guarantor_relations')
      .update({
        status: newStatus,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', relation_id)

    if (error) {
      return Response.json({ error: error.message }, { status: 400 })
    }

    // Log audit
    await createAuditLog('update', 'guarantor_relations', relation_id, null, {
      status: newStatus,
    })

    return Response.json({ success: true, status: newStatus })
  }

  return Response.json({ error: 'Invalid action' }, { status: 400 })
}
