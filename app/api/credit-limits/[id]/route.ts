import { createClient } from '@/lib/supabase/server'
import { createAuditLog } from '@/lib/audit-logger'
import { canUpdate } from '@/lib/permissions'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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

    if (!canUpdate(userProfile?.role)) {
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
        return Response.json({ error: 'Límite de crédito no encontrado' }, { status: 404 })
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
        return Response.json({ error: 'Límite de crédito no encontrado' }, { status: 404 })
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
    console.error('[v0] Error in PATCH /api/credit-limits/[id]:', err)
    return Response.json({ error: 'Server error' }, { status: 500 })
  }
}
