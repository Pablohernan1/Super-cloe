-- =====================================================================
-- Supermercado Cloe -- Marcar préstamo "completed" cuando se pagan todas
-- las cuotas.
--
-- Bug reportado por el usuario probando la app: un préstamo totalmente
-- pagado seguía figurando "Activo" en vez de "Completado" -- register_payment
-- nunca chequeaba esta condición, solo sabía volver de 'defaulted' a
-- 'active' cuando se regularizaba la mora.
-- =====================================================================

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
  v_all_paid BOOLEAN;
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

  -- Si el préstamo ya no tiene cuotas vencidas, vuelve a 'active'
  UPDATE public.loans l
  SET status = 'active'
  WHERE l.id = v_installment.loan_id
    AND l.status = 'defaulted'
    AND NOT EXISTS (SELECT 1 FROM public.installments i WHERE i.loan_id = l.id AND i.status = 'overdue');

  -- Si TODAS las cuotas del préstamo ya están pagas, se completa y libera
  -- el crédito comprometido correspondiente (el trigger
  -- release_credit_on_loan_close solo libera en 'cancelled' -- acá se
  -- libera explícito porque "completed" es una forma normal de cerrar,
  -- no una cancelación).
  SELECT NOT EXISTS (
    SELECT 1 FROM public.installments i WHERE i.loan_id = v_installment.loan_id AND i.status <> 'paid'
  ) INTO v_all_paid;

  IF v_all_paid THEN
    UPDATE public.loans
    SET status = 'completed'
    WHERE id = v_installment.loan_id AND status IN ('active', 'defaulted');

    UPDATE public.credit_limits cl
    SET committed_limit = GREATEST(cl.committed_limit - l.total_amount, 0)
    FROM public.loans l
    WHERE l.id = v_installment.loan_id
      AND cl.customer_id = l.customer_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'payment_number', v_payment_number,
    'applied_penalty', v_to_penalty,
    'applied_installment', v_to_installment,
    'installment_status', v_new_status,
    'loan_completed', v_all_paid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
