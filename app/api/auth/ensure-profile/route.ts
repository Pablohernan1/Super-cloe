import { createClient } from '@/lib/supabase/server'

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[v0] Ensuring profile exists for user:', user.id, user.email)

    // Check if profile exists - use limit 1 instead of single to avoid errors
    const { data: profiles, error: fetchError } = await supabase
      .from('profiles')
      .select('id, role, email')
      .eq('id', user.id)
      .limit(1)

    if (fetchError) {
      console.error('[v0] Error fetching profile:', fetchError)
      return Response.json({ error: 'Failed to fetch profile' }, { status: 500 })
    }

    if (profiles && profiles.length > 0) {
      console.log('[v0] Profile exists:', profiles[0].role)
      return Response.json({ success: true, profile: profiles[0], exists: true })
    }

    // Profile doesn't exist - create it
    console.log('[v0] Creating new profile with role: cajero')
    const { data: newProfile, error: createError } = await supabase
      .from('profiles')
      .insert({
        id: user.id,
        email: user.email,
        full_name: user.user_metadata?.full_name || 'Usuario',
        role: 'cajero',
        status: 'active',
        employee_code: `EMP-${Date.now()}`,
      })
      .select()
      .limit(1)

    if (createError) {
      console.error('[v0] Error creating profile:', createError.message)
      return Response.json({ error: createError.message }, { status: 500 })
    }

    if (newProfile && newProfile.length > 0) {
      console.log('[v0] Profile created:', newProfile[0].role)
      return Response.json({ success: true, profile: newProfile[0], created: true })
    }

    return Response.json({ error: 'Unknown error creating profile' }, { status: 500 })
  } catch (error) {
    console.error('[v0] Exception in ensure-profile:', error)
    return Response.json({ error: String(error) }, { status: 500 })
  }
}
