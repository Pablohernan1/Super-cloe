import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// This endpoint seeds test users - should only be used in development
export async function POST(request: Request) {
  // Check for seed secret to prevent unauthorized access
  const { searchParams } = new URL(request.url)
  const secret = searchParams.get('secret')
  
  if (secret !== process.env.SEED_SECRET && secret !== 'cloe-seed-2024') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  if (!supabaseServiceKey) {
    return NextResponse.json({ 
      error: 'SUPABASE_SERVICE_ROLE_KEY not configured' 
    }, { status: 500 })
  }

  // Create admin client with service role key
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })

  const testUsers = [
    // Administradores
    {
      email: 'admin@cloe.com',
      password: 'Cloe2024!',
      employee_code: 'ADM001',
      full_name: 'Carlos Administrador',
      role: 'administrador',
      phone: '11-5555-0001'
    },
    {
      email: 'admin2@cloe.com', 
      password: 'Cloe2024!',
      employee_code: 'ADM002',
      full_name: 'María Gerente',
      role: 'administrador',
      phone: '11-5555-0002'
    },
    // Supervisores
    {
      email: 'supervisor@cloe.com',
      password: 'Cloe2024!',
      employee_code: 'SUP001',
      full_name: 'Juan Supervisor',
      role: 'supervisor',
      phone: '11-5555-0010'
    },
    {
      email: 'supervisor2@cloe.com',
      password: 'Cloe2024!',
      employee_code: 'SUP002',
      full_name: 'Ana Supervisora',
      role: 'supervisor',
      phone: '11-5555-0011'
    },
    // Cajeros
    {
      email: 'cajero1@cloe.com',
      password: 'Cloe2024!',
      employee_code: 'CAJ001',
      full_name: 'Pedro Cajero',
      role: 'cajero',
      phone: '11-5555-0100'
    },
    {
      email: 'cajero2@cloe.com',
      password: 'Cloe2024!',
      employee_code: 'CAJ002',
      full_name: 'Laura Cajera',
      role: 'cajero',
      phone: '11-5555-0101'
    },
    {
      email: 'cajero3@cloe.com',
      password: 'Cloe2024!',
      employee_code: 'CAJ003',
      full_name: 'Diego Cajero',
      role: 'cajero',
      phone: '11-5555-0102'
    }
  ]

  const results = []
  const errors = []

  for (const user of testUsers) {
    try {
      // Create auth user
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true, // Auto-confirm email for test users
        user_metadata: {
          full_name: user.full_name,
          employee_code: user.employee_code
        }
      })

      if (authError) {
        errors.push({ email: user.email, error: authError.message })
        continue
      }

      // Create profile
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .insert({
          id: authData.user.id,
          employee_code: user.employee_code,
          full_name: user.full_name,
          role: user.role,
          email: user.email,
          phone: user.phone,
          status: 'active',
          password_changed_at: new Date().toISOString()
        })

      if (profileError) {
        errors.push({ email: user.email, error: profileError.message })
        continue
      }

      results.push({
        email: user.email,
        employee_code: user.employee_code,
        full_name: user.full_name,
        role: user.role,
        password: user.password
      })
    } catch (err) {
      errors.push({ email: user.email, error: String(err) })
    }
  }

  return NextResponse.json({
    success: true,
    created: results,
    errors: errors.length > 0 ? errors : undefined,
    message: `Created ${results.length} users successfully`
  })
}
