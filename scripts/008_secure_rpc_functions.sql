-- =====================================================================
-- Supermercado Cloe -- Endurecer funciones RPC para el futuro cliente de
-- escritorio (Electron habla directo con Supabase, sin la capa de Next.js
-- que hoy filtra por rol antes de llamar al RPC).
--
-- Problema encontrado probando con un usuario cajero real: `create_loan` y
-- `rehabilitate_customer` no validaban el rol de quien llama -- sólo el
-- route handler de Next.js lo hacía. Un cajero podía invocar el RPC directo
-- por REST y confirmar un préstamo o rehabilitar una cuenta, algo reservado
-- a supervisor+ (spec 4, 8.6). Además `p_user_id` era un parámetro que el
-- cliente podía mandar con cualquier valor (spoofing de auditoría).
--
-- Fix: usar auth.uid() (identidad real de la sesión, no falsificable, sigue
-- disponible dentro de una función SECURITY DEFINER) en vez de un parámetro
-- p_user_id, y validar el rol contra profiles ahí mismo.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.create_loan(
  p_customer_id UUID,
  p_principal_amount NUMERIC,
  p_term_months INT,
  p_guarantor_ids UUID[],
  p_purpose TEXT
) RETURNS JSONB AS $$
DECLARE
  v_caller_role user_role;
  v_customer public.customers%ROWTYPE;
  v_credit_limit public.credit_limits%ROWTYPE;
  v_rate NUMERIC;
  v_total NUMERIC;
  v_installment_base NUMERIC;
  v_installment_remainder NUMERIC;
  v_loan public.loans%ROWTYPE;
  v_loan_number TEXT;
  v_guarantor_id UUID;
  v_active_guarantors INT;
  v_open_loans INT;
  v_max_installments INT;
  v_min_amount NUMERIC;
  v_max_amount NUMERIC;
  v_max_loans_per_customer INT;
  v_max_loans_guaranteed NUMERIC;
  v_guaranteed_count INT;
  v_due_date DATE;
  v_i INT;
  v_installments JSONB := '[]'::jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();
  IF v_caller_role IS NULL OR v_caller_role NOT IN ('supervisor', 'administrador') THEN
    RAISE EXCEPTION 'Confirmar un préstamo requiere perfil supervisor o administrador';
  END IF;

  IF p_guarantor_ids IS NULL OR array_length(p_guarantor_ids, 1) IS NULL OR array_length(p_guarantor_ids, 1) < 1 THEN
    RAISE EXCEPTION 'No se puede otorgar un préstamo sin garantes (mínimo 1)';
  END IF;
  IF array_length(p_guarantor_ids, 1) > 2 THEN
    RAISE EXCEPTION 'Un préstamo admite como máximo 2 garantes';
  END IF;

  SELECT * INTO v_customer FROM public.customers WHERE id = p_customer_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cliente no encontrado';
  END IF;
  IF v_customer.status <> 'active' THEN
    RAISE EXCEPTION 'Cliente no habilitado para operar (estado: %)', v_customer.status;
  END IF;

  v_max_installments := public.get_parameter_numeric('max_installments', 3);
  IF p_term_months < 1 OR p_term_months > v_max_installments THEN
    RAISE EXCEPTION 'Cantidad de cuotas inválida (máximo %)', v_max_installments;
  END IF;

  v_min_amount := public.get_parameter_numeric('min_loan_amount', 1000);
  v_max_amount := public.get_parameter_numeric('max_loan_amount', 500000);
  IF p_principal_amount < v_min_amount OR p_principal_amount > v_max_amount THEN
    RAISE EXCEPTION 'El capital solicitado debe estar entre % y %', v_min_amount, v_max_amount;
  END IF;

  SELECT COUNT(*) INTO v_active_guarantors
  FROM public.guarantor_relations gr
  JOIN public.customers c ON c.id = gr.guarantor_customer_id
  WHERE gr.titular_customer_id = p_customer_id
    AND gr.status = 'active'
    AND c.status = 'active'
    AND gr.guarantor_customer_id = ANY(p_guarantor_ids);

  IF v_active_guarantors < array_length(p_guarantor_ids, 1) THEN
    RAISE EXCEPTION 'Uno o más garantes indicados no están activos y vinculados a este titular';
  END IF;

  v_max_loans_guaranteed := public.get_parameter_numeric('max_loans_guaranteed_per_guarantor', 3);
  FOREACH v_guarantor_id IN ARRAY p_guarantor_ids LOOP
    SELECT COUNT(*) INTO v_guaranteed_count
    FROM public.loan_guarantors lg
    JOIN public.loans l ON l.id = lg.loan_id
    WHERE lg.guarantor_customer_id = v_guarantor_id
      AND l.status IN ('pending', 'approved', 'active');

    IF v_guaranteed_count >= v_max_loans_guaranteed THEN
      RAISE EXCEPTION 'Un garante alcanzó el máximo de % préstamos garantizados', v_max_loans_guaranteed;
    END IF;
  END LOOP;

  v_max_loans_per_customer := public.get_parameter_numeric('max_loans_per_customer', 3);
  SELECT COUNT(*) INTO v_open_loans
  FROM public.loans
  WHERE customer_id = p_customer_id AND status IN ('pending', 'approved', 'active');

  IF v_open_loans >= v_max_loans_per_customer THEN
    RAISE EXCEPTION 'El cliente alcanzó el máximo de % préstamos vigentes', v_max_loans_per_customer;
  END IF;

  SELECT * INTO v_credit_limit FROM public.credit_limits WHERE customer_id = p_customer_id FOR UPDATE;
  IF NOT FOUND OR v_credit_limit.status <> 'approved' THEN
    RAISE EXCEPTION 'El cliente no tiene un límite de crédito aprobado';
  END IF;
  IF p_principal_amount > v_credit_limit.available_credit THEN
    RAISE EXCEPTION 'El capital solicitado ($%) supera el disponible ($%)', p_principal_amount, v_credit_limit.available_credit;
  END IF;

  v_rate := CASE p_term_months
    WHEN 1 THEN public.get_parameter_numeric('interest_rate_1_installment', 0.15)
    WHEN 2 THEN public.get_parameter_numeric('interest_rate_2_installments', 0.25)
    WHEN 3 THEN public.get_parameter_numeric('interest_rate_3_installments', 0.30)
    ELSE public.get_parameter_numeric('interest_rate_3_installments', 0.30)
  END;

  v_total := ROUND(p_principal_amount + p_principal_amount * v_rate, 2);
  v_installment_base := ROUND(v_total / p_term_months, 2);
  v_installment_remainder := v_total - (v_installment_base * p_term_months);

  v_loan_number := 'PR-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');

  INSERT INTO public.loans (
    loan_number, customer_id, principal_amount, interest_rate, total_amount,
    term_months, installment_amount, status, purpose,
    disbursement_date, first_due_date, approved_at, approved_by, created_by
  ) VALUES (
    v_loan_number, p_customer_id, p_principal_amount, v_rate, v_total,
    p_term_months, v_installment_base, 'active', p_purpose,
    CURRENT_DATE, (CURRENT_DATE + INTERVAL '1 month')::date, NOW(), auth.uid(), auth.uid()
  ) RETURNING * INTO v_loan;

  FOREACH v_guarantor_id IN ARRAY p_guarantor_ids LOOP
    INSERT INTO public.loan_guarantors (loan_id, guarantor_customer_id)
    VALUES (v_loan.id, v_guarantor_id);
  END LOOP;

  FOR v_i IN 1..p_term_months LOOP
    v_due_date := (CURRENT_DATE + (INTERVAL '1 month' * v_i))::date;

    INSERT INTO public.installments (
      loan_id, installment_number, due_date, principal_amount, interest_amount, total_amount, status
    ) VALUES (
      v_loan.id,
      v_i,
      v_due_date,
      ROUND(p_principal_amount / p_term_months, 2),
      (CASE WHEN v_i = p_term_months THEN v_installment_base + v_installment_remainder ELSE v_installment_base END)
        - ROUND(p_principal_amount / p_term_months, 2),
      CASE WHEN v_i = p_term_months THEN v_installment_base + v_installment_remainder ELSE v_installment_base END,
      'pending'
    );

    v_installments := v_installments || jsonb_build_object(
      'installment_number', v_i,
      'due_date', v_due_date,
      'total_amount', CASE WHEN v_i = p_term_months THEN v_installment_base + v_installment_remainder ELSE v_installment_base END
    );
  END LOOP;

  UPDATE public.credit_limits
  SET committed_limit = committed_limit + v_total,
      updated_by = auth.uid()
  WHERE id = v_credit_limit.id;

  INSERT INTO public.audit_logs (user_id, action, table_name, record_id, old_values, new_values)
  VALUES (auth.uid(), 'create', 'loans', v_loan.id, NULL, jsonb_build_object(
    'customer_id', p_customer_id,
    'principal_amount', p_principal_amount,
    'interest_rate', v_rate,
    'term_months', p_term_months,
    'total_amount', v_total,
    'guarantor_ids', p_guarantor_ids
  ));

  RETURN jsonb_build_object(
    'success', true,
    'loan', to_jsonb(v_loan),
    'installments', v_installments
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- register_payment: cajero+ puede registrar pagos (spec 4), pero el usuario
-- que queda en el pago/auditoría es auth.uid(), no lo que mande el cliente.
CREATE OR REPLACE FUNCTION public.register_payment(
  p_installment_id UUID,
  p_amount NUMERIC,
  p_payment_method payment_method,
  p_reference_number TEXT,
  p_notes TEXT
) RETURNS JSONB AS $$
DECLARE
  v_installment public.installments%ROWTYPE;
  v_outstanding NUMERIC;
  v_penalty_outstanding NUMERIC;
  v_to_penalty NUMERIC;
  v_to_installment NUMERIC;
  v_payment_number TEXT;
  v_new_status installment_status;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'El importe del pago debe ser mayor a 0';
  END IF;

  SELECT * INTO v_installment FROM public.installments WHERE id = p_installment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cuota no encontrada';
  END IF;

  v_penalty_outstanding := v_installment.penalty_amount;
  v_outstanding := v_installment.total_amount - v_installment.paid_amount;

  v_to_penalty := LEAST(p_amount, v_penalty_outstanding);
  v_to_installment := LEAST(p_amount - v_to_penalty, v_outstanding);

  v_new_status := CASE
    WHEN (v_installment.paid_amount + v_to_installment) >= v_installment.total_amount THEN 'paid'
    WHEN (v_installment.paid_amount + v_to_installment) > 0 THEN 'partial'
    ELSE v_installment.status
  END;

  UPDATE public.installments
  SET paid_amount = paid_amount + v_to_installment,
      penalty_amount = GREATEST(penalty_amount - v_to_penalty, 0),
      status = v_new_status,
      paid_at = CASE WHEN v_new_status = 'paid' THEN NOW() ELSE paid_at END
  WHERE id = p_installment_id;

  v_payment_number := 'PAG-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(NEXTVAL('public.payment_number_seq')::TEXT, 5, '0');

  INSERT INTO public.payments (
    payment_number, installment_id, amount, applied_penalty, payment_method, reference_number, notes, received_at, created_by
  ) VALUES (
    v_payment_number, p_installment_id, p_amount, v_to_penalty, p_payment_method, p_reference_number, p_notes, NOW(), auth.uid()
  );

  INSERT INTO public.audit_logs (user_id, action, table_name, record_id, new_values)
  VALUES (auth.uid(), 'create', 'payments', p_installment_id, jsonb_build_object(
    'payment_number', v_payment_number,
    'amount', p_amount,
    'applied_penalty', v_to_penalty,
    'applied_installment', v_to_installment
  ));

  UPDATE public.loans l
  SET status = 'active'
  WHERE l.id = v_installment.loan_id
    AND l.status = 'defaulted'
    AND NOT EXISTS (SELECT 1 FROM public.installments i WHERE i.loan_id = l.id AND i.status = 'overdue');

  RETURN jsonb_build_object(
    'success', true,
    'payment_number', v_payment_number,
    'applied_penalty', v_to_penalty,
    'applied_installment', v_to_installment,
    'installment_status', v_new_status
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- rehabilitate_customer: restringido a supervisor+ (desbloqueo manual, spec 4).
CREATE OR REPLACE FUNCTION public.rehabilitate_customer(
  p_customer_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_caller_role user_role;
  v_customer public.customers%ROWTYPE;
  v_pending_amount NUMERIC;
  v_guarantor RECORD;
  v_has_own_default BOOLEAN;
  v_unblocked UUID[] := ARRAY[]::UUID[];
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();
  IF v_caller_role IS NULL OR v_caller_role NOT IN ('supervisor', 'administrador') THEN
    RAISE EXCEPTION 'Rehabilitar una cuenta requiere perfil supervisor o administrador';
  END IF;

  SELECT * INTO v_customer FROM public.customers WHERE id = p_customer_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cliente no encontrado';
  END IF;
  IF v_customer.status <> 'blocked' THEN
    RETURN jsonb_build_object('success', false, 'error', 'El cliente no está bloqueado');
  END IF;

  SELECT COALESCE(SUM(i.total_amount - i.paid_amount + i.penalty_amount), 0) INTO v_pending_amount
  FROM public.installments i
  JOIN public.loans l ON l.id = i.loan_id
  WHERE l.customer_id = p_customer_id AND i.status = 'overdue';

  IF v_pending_amount > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Aún hay cuotas vencidas sin regularizar',
      'pending_amount', v_pending_amount
    );
  END IF;

  UPDATE public.customers SET status = 'active' WHERE id = p_customer_id;
  v_unblocked := v_unblocked || p_customer_id;

  INSERT INTO public.audit_logs (user_id, action, table_name, record_id, old_values, new_values)
  VALUES (auth.uid(), 'update', 'customers', p_customer_id, jsonb_build_object('status', 'blocked'),
          jsonb_build_object('status', 'active', 'reason', 'rehabilitacion'));

  FOR v_guarantor IN
    SELECT gr.guarantor_customer_id
    FROM public.guarantor_relations gr
    JOIN public.customers c ON c.id = gr.guarantor_customer_id
    WHERE gr.titular_customer_id = p_customer_id
      AND gr.status = 'active'
      AND c.status = 'blocked'
  LOOP
    SELECT EXISTS (
      SELECT 1 FROM public.loans l
      WHERE l.customer_id = v_guarantor.guarantor_customer_id AND l.status = 'defaulted'
    ) INTO v_has_own_default;

    IF NOT v_has_own_default THEN
      UPDATE public.customers SET status = 'active' WHERE id = v_guarantor.guarantor_customer_id;
      v_unblocked := v_unblocked || v_guarantor.guarantor_customer_id;

      INSERT INTO public.audit_logs (user_id, action, table_name, record_id, old_values, new_values)
      VALUES (auth.uid(), 'update', 'customers', v_guarantor.guarantor_customer_id, jsonb_build_object('status', 'blocked'),
              jsonb_build_object('status', 'active', 'reason', 'rehabilitacion_titular', 'titular_customer_id', p_customer_id));
    END IF;
  END LOOP;

  UPDATE public.alerts
  SET is_read = true, read_at = NOW(), read_by = auth.uid()
  WHERE reference_type = 'loan' AND is_read = false
    AND reference_id IN (SELECT id FROM public.loans WHERE customer_id = p_customer_id);

  RETURN jsonb_build_object('success', true, 'unblocked_customer_ids', to_jsonb(v_unblocked));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Firmas viejas (con p_user_id) ya no se usan -- se limpian para que no
-- quede una versión insegura invocable en paralelo.
DROP FUNCTION IF EXISTS public.create_loan(UUID, NUMERIC, INT, UUID[], TEXT, UUID);
DROP FUNCTION IF EXISTS public.register_payment(UUID, NUMERIC, payment_method, TEXT, TEXT, UUID);
DROP FUNCTION IF EXISTS public.rehabilitate_customer(UUID, UUID);
