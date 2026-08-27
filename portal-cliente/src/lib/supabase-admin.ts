import 'server-only'
import { createClient } from '@supabase/supabase-js'

// Service role: nunca se expone al navegador (sin prefijo NEXT_PUBLIC_,
// solo se usa en Server Components / Server Actions). El portal no
// necesita RLS -- el token del QR + el segundo factor (últimos 4 dígitos
// del documento) son el control de acceso.
const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en el entorno del portal')
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false },
})
