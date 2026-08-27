-- Backfill único: préstamos que ya estaban totalmente pagos antes del fix
-- de register_payment (scripts/012) y habían quedado atascados en 'active'.
DO $$
DECLARE
  v_loan RECORD;
BEGIN
  FOR v_loan IN
    SELECT l.id, l.customer_id, l.total_amount
    FROM public.loans l
    WHERE l.status IN ('active', 'defaulted')
      AND NOT EXISTS (SELECT 1 FROM public.installments i WHERE i.loan_id = l.id AND i.status <> 'paid')
      AND EXISTS (SELECT 1 FROM public.installments i WHERE i.loan_id = l.id)
  LOOP
    UPDATE public.loans SET status = 'completed' WHERE id = v_loan.id;

    UPDATE public.credit_limits
    SET committed_limit = GREATEST(committed_limit - v_loan.total_amount, 0)
    WHERE customer_id = v_loan.customer_id;
  END LOOP;
END $$;
