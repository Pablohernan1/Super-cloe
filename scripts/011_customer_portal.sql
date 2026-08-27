-- =====================================================================
-- Supermercado Cloe -- Portal de consulta para el cliente final (QR)
--
-- El cliente recibe una tarjeta física con un QR único. Al escanearlo
-- entra a un portal de solo lectura (hosteado aparte, en Vercel) que
-- pide un segundo factor (últimos 4 dígitos del documento) antes de
-- mostrar nada -- así una tarjeta perdida o fotografiada no alcanza sola
-- para ver la deuda de otra persona.
--
-- El token es de alta entropía (uuid v4) e independiente del
-- customer_code/document_number (que sí son adivinables/secuenciales),
-- para que no se pueda enumerar clientes probando URLs.
-- =====================================================================

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS portal_token UUID NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_portal_token ON public.customers(portal_token);

-- El portal corre server-side con la service_role key (nunca se expone al
-- navegador del cliente) y no pasa por RLS de todos modos, pero declaramos
-- explícitamente que el token nunca debería ser legible por el cliente ni
-- por roles sin autenticar -- no se agrega policy de SELECT pública acá a
-- propósito, todo el acceso público pasa por el backend del portal.
