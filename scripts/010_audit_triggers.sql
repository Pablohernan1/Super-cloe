-- =====================================================================
-- Supermercado Cloe -- Auditoría automática vía triggers (spec 8.6)
--
-- Encontrado revisando el spec contra la app de escritorio: al sacar la
-- capa de API routes de Next.js (que sí llamaban a createAuditLog()), el
-- alta/edición de clientes y garantes en desktop/ quedó sin auditar --
-- inserta/actualiza directo desde el cliente sin pasar por ningún lado que
-- deje rastro. Mover la auditoría a triggers en las tablas garantiza
-- trazabilidad sin importar qué cliente (Next.js, Electron, o una edición
-- futura) haga el cambio -- coherente con la decisión de que las reglas
-- críticas viven en Postgres, no en cada pantalla.
--
-- No se agrega a loans/payments/rehabilitación: esas ya quedan auditadas
-- explícitamente y con más detalle dentro de create_loan/register_payment/
-- rehabilitate_customer/refresh_mora_and_blocks.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.audit_row_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (user_id, action, table_name, record_id, old_values, new_values)
    VALUES (auth.uid(), 'create', TG_TABLE_NAME, NEW.id, NULL, to_jsonb(NEW));
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_logs (user_id, action, table_name, record_id, old_values, new_values)
    VALUES (auth.uid(), 'update', TG_TABLE_NAME, NEW.id, to_jsonb(OLD), to_jsonb(NEW));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['customers', 'guarantor_relations', 'credit_limits']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_row_change ON public.%I', t);
    EXECUTE format('CREATE TRIGGER trg_audit_row_change AFTER INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.audit_row_change()', t);
  END LOOP;
END $$;
