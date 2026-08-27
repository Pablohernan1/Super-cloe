-- =====================================================================
-- Supermercado Cloe -- Alertas de mora temprana (no solo bloqueo)
--
-- Pantalla H del spec ("Gestión de riesgo diario") muestra cuentas con
-- distintos grados de atraso, incluidas las que todavía NO están
-- bloqueadas (ej. el mockup: Ana López, 7 días, Bloq.=No). La versión
-- anterior de refresh_mora_and_blocks solo generaba una alerta cuando la
-- cuenta ya cruzaba el umbral de bloqueo (grace_period_days) -- una cuenta
-- recién vencida no aparecía en Alertas hasta bloquearse. Se separa la
-- generación de alertas (cualquier cuota vencida) del bloqueo en sí
-- (sigue exclusivo de cuando se supera grace_period_days).
-- =====================================================================

CREATE OR REPLACE FUNCTION public.refresh_mora_and_blocks()
RETURNS JSONB AS $$
DECLARE
  v_grace_days INT;
  v_daily_rate NUMERIC;
  v_loan RECORD;
  v_priority alert_priority;
  v_newly_blocked INT := 0;
  v_installments_flagged INT := 0;
  v_alerts_upserted INT := 0;
BEGIN
  v_grace_days := public.get_parameter_numeric('mora_grace_period_days', 5);
  v_daily_rate := public.get_parameter_numeric('mora_daily_penalty_rate_pct', 0.5);

  -- 1) Marcar cuotas vencidas y recalcular interés de mora acumulado
  UPDATE public.installments i
  SET status = 'overdue',
      penalty_amount = ROUND((i.total_amount - i.paid_amount) * (v_daily_rate / 100.0) * (CURRENT_DATE - i.due_date), 2)
  WHERE i.status IN ('pending', 'partial')
    AND i.due_date < CURRENT_DATE
    AND (i.total_amount - i.paid_amount) > 0;
  GET DIAGNOSTICS v_installments_flagged = ROW_COUNT;

  UPDATE public.installments i
  SET penalty_amount = ROUND((i.total_amount - i.paid_amount) * (v_daily_rate / 100.0) * (CURRENT_DATE - i.due_date), 2)
  WHERE i.status = 'overdue' AND (i.total_amount - i.paid_amount) > 0;

  -- 2) Alertas: CUALQUIER préstamo con al menos una cuota vencida entra a
  -- la lista de seguimiento de riesgo, esté bloqueado o no todavía.
  FOR v_loan IN
    SELECT l.id AS loan_id, l.customer_id, l.loan_number,
           MAX(CURRENT_DATE - i.due_date) AS max_days_overdue,
           SUM(i.total_amount - i.paid_amount + i.penalty_amount) AS saldo
    FROM public.loans l
    JOIN public.installments i ON i.loan_id = l.id
    WHERE l.status IN ('active', 'approved', 'defaulted')
      AND i.status = 'overdue'
    GROUP BY l.id, l.customer_id, l.loan_number
  LOOP
    v_priority := CASE
      WHEN v_loan.max_days_overdue >= 30 THEN 'critical'
      WHEN v_loan.max_days_overdue >= 14 THEN 'high'
      WHEN v_loan.max_days_overdue > v_grace_days THEN 'medium'
      ELSE 'low'
    END;

    IF NOT EXISTS (
      SELECT 1 FROM public.alerts
      WHERE reference_type = 'loan' AND reference_id = v_loan.loan_id
        AND alert_type = 'overdue' AND is_read = false
    ) THEN
      INSERT INTO public.alerts (alert_type, priority, title, message, reference_id, reference_type)
      VALUES (
        'overdue', v_priority,
        'Préstamo ' || v_loan.loan_number || ' en mora',
        v_loan.max_days_overdue || ' días de atraso, saldo $' || v_loan.saldo,
        v_loan.loan_id, 'loan'
      );
    ELSE
      UPDATE public.alerts
      SET priority = v_priority,
          message = v_loan.max_days_overdue || ' días de atraso, saldo $' || v_loan.saldo
      WHERE reference_type = 'loan' AND reference_id = v_loan.loan_id
        AND alert_type = 'overdue' AND is_read = false;
    END IF;
    v_alerts_upserted := v_alerts_upserted + 1;

    -- 3) Bloqueo: solo cuando se supera la tolerancia de días de gracia.
    IF v_loan.max_days_overdue > v_grace_days THEN
      UPDATE public.loans SET status = 'defaulted' WHERE id = v_loan.loan_id AND status <> 'defaulted';

      IF NOT EXISTS (
        SELECT 1 FROM public.customers WHERE id = v_loan.customer_id AND status = 'blocked'
      ) THEN
        UPDATE public.customers SET status = 'blocked' WHERE id = v_loan.customer_id;
        v_newly_blocked := v_newly_blocked + 1;
        INSERT INTO public.audit_logs (action, table_name, record_id, old_values, new_values)
        VALUES ('update', 'customers', v_loan.customer_id, jsonb_build_object('status', 'active'),
                jsonb_build_object('status', 'blocked', 'reason', 'mora', 'loan_id', v_loan.loan_id));

        UPDATE public.customers c
        SET status = 'blocked'
        FROM public.guarantor_relations gr
        WHERE gr.titular_customer_id = v_loan.customer_id
          AND gr.status = 'active'
          AND c.id = gr.guarantor_customer_id
          AND c.status = 'active';

        INSERT INTO public.audit_logs (action, table_name, record_id, new_values)
        SELECT 'update', 'customers', gr.guarantor_customer_id,
               jsonb_build_object('status', 'blocked', 'reason', 'mora_titular', 'titular_customer_id', v_loan.customer_id, 'loan_id', v_loan.loan_id)
        FROM public.guarantor_relations gr
        WHERE gr.titular_customer_id = v_loan.customer_id AND gr.status = 'active';
      END IF;
    END IF;
  END LOOP;

  -- 4) Préstamos que se regularizaron (sin cuotas overdue) vuelven a 'active'
  UPDATE public.loans l
  SET status = 'active'
  WHERE l.status = 'defaulted'
    AND NOT EXISTS (SELECT 1 FROM public.installments i WHERE i.loan_id = l.id AND i.status = 'overdue');

  -- 5) Alertas de préstamos que ya se regularizaron: marcarlas leídas
  UPDATE public.alerts a
  SET is_read = true, read_at = NOW()
  WHERE a.alert_type = 'overdue' AND a.is_read = false AND a.reference_type = 'loan'
    AND NOT EXISTS (
      SELECT 1 FROM public.installments i
      JOIN public.loans l ON l.id = i.loan_id
      WHERE l.id = a.reference_id AND i.status = 'overdue'
    );

  RETURN jsonb_build_object(
    'installments_flagged', v_installments_flagged,
    'alerts_upserted', v_alerts_upserted,
    'customers_newly_blocked', v_newly_blocked,
    'run_at', NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
