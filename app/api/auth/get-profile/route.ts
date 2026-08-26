import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[v0] API: Getting profile for user:', user.id)

    // Get profile using server-side client (bypasses RLS issues)
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .limit(1)

    if (error) {
      console.error('[v0] API: Error fetching profile:', error.message)
      return Response.json({ error: error.message }, { status: 500 })
    }

    if (!profiles || profiles.length === 0) {
      console.warn('[v0] API: No profile found for user:', user.id)
      return Response.json({ error: 'Profile not found' }, { status: 404 })
    }

    const profile = profiles[0]
    console.log('[v0] API: Profile returned:', { role: profile.role, full_name: profile.full_name })

    return Response.json({ profile })
  } catch (error) {
    console.error('[v0] API: Exception in get-profile:', error)
    return Response.json({ error: 'Server error' }, { status: 500 })
  }
}
