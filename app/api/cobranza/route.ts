import { createClient } from '@/lib/supabase/server'

// Registrar un pago de cuota. La lógica de imputación (interés de mora
// primero, luego cuota) vive en la función Postgres `register_payment`
// (spec 11: validaciones también en backend).
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { installment_id, amount, payment_method, reference_number, notes } = await request.json()

    if (!installment_id || !amount || !payment_method) {
      return Response.json(
        { error: 'Faltan campos requeridos: installment_id, amount, payment_method' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase.rpc('register_payment', {
      p_installment_id: installment_id,
      p_amount: amount,
      p_payment_method: payment_method,
      p_reference_number: reference_number || null,
      p_notes: notes || null,
    })

    if (error) {
      console.error('[v0] Error registering payment:', error)
      return Response.json({ error: error.message }, { status: 400 })
    }

    return Response.json(data)
  } catch (error) {
    console.error('[v0] Error in POST /api/cobranza:', error)
    return Response.json({ error: 'Server error' }, { status: 500 })
  }
}

// Rehabilitar un cliente bloqueado por mora una vez regularizada la deuda
// vencida (spec 8.5, pantalla G). Restringido a supervisor+ (desbloqueo
// manual queda como acción de supervisión).
export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: userProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!['supervisor', 'administrador'].includes(userProfile?.role || '')) {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { customer_id } = await request.json()

    if (!customer_id) {
      return Response.json({ error: 'Falta customer_id' }, { status: 400 })
    }

    const { data, error } = await supabase.rpc('rehabilitate_customer', {
      p_customer_id: customer_id,
    })

    if (error) {
      console.error('[v0] Error rehabilitating customer:', error)
      return Response.json({ error: error.message }, { status: 400 })
    }

    return Response.json(data)
  } catch (error) {
    console.error('[v0] Error in PATCH /api/cobranza:', error)
    return Response.json({ error: 'Server error' }, { status: 500 })
  }
}
