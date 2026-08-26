import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const limit = parseInt(searchParams.get('limit') || '10')

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (search.length < 1) {
      return Response.json({ customers: [] })
    }

    console.log('[v0] Searching customers:', { search, limit })

    // Search by name or CUIT
    const { data, error } = await supabase
      .from('customers')
      .select('id, first_name, last_name, cuit_cuil, status, customer_code')
      .or(
        `first_name.ilike.%${search}%,last_name.ilike.%${search}%,cuit_cuil.ilike.%${search}%,customer_code.ilike.%${search}%`
      )
      .eq('status', 'active')
      .limit(limit)

    if (error) {
      console.error('[v0] Search error:', error)
      return Response.json({ error: 'Search failed' }, { status: 400 })
    }

    console.log('[v0] Found customers:', data?.length)

    return Response.json({
      customers: data || [],
      total: data?.length || 0,
    })
  } catch (error) {
    console.error('[v0] Error in customers search:', error)
    return Response.json({ error: 'Server error' }, { status: 500 })
  }
}
