import { createClient } from '@/lib/supabase/server'

// Refresca mora/bloqueos (recalcula cuotas vencidas, interés de mora,
// bloqueo de titular+garantes) y devuelve las alertas activas (spec
// pantalla H). Se llama al entrar a la pantalla de Alertas -- no depende
// de un cron externo.
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { error: refreshError } = await supabase.rpc('refresh_mora_and_blocks')
    if (refreshError) {
      console.error('[v0] Error refreshing mora status:', refreshError)
    }

    const { data: alerts, error } = await supabase
      .from('alerts')
      .select('*')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }

    return Response.json({ alerts: alerts || [] })
  } catch (error) {
    console.error('[v0] Error in GET /api/alertas:', error)
    return Response.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await request.json()
    if (!id) {
      return Response.json({ error: 'Falta id' }, { status: 400 })
    }

    const { error } = await supabase
      .from('alerts')
      .update({ is_read: true, read_at: new Date().toISOString(), read_by: user.id })
      .eq('id', id)

    if (error) {
      return Response.json({ error: error.message }, { status: 400 })
    }

    return Response.json({ success: true })
  } catch (error) {
    console.error('[v0] Error in PATCH /api/alertas:', error)
    return Response.json({ error: 'Server error' }, { status: 500 })
  }
}
