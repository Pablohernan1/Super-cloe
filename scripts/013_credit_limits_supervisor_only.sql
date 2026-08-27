-- =====================================================================
-- Supermercado Cloe -- Gestión de límites de crédito, exclusiva de
-- supervisor+ (spec 4, paso 4 del flujo end-to-end).
--
-- Hasta ahora cualquier rol autenticado podía crear un credit_limits vía
-- INSERT (la UI ya lo restringía, pero la base lo permitía igual -- un
-- cajero podía crearlo llamando la API directo). El usuario notó que el
-- cajero veía/gestionaba más de lo que debería; esta es la pieza que
-- faltaba blindar en el backend, no solo esconder en pantalla.
-- =====================================================================

DROP POLICY IF EXISTS "credit_limits_insert" ON public.credit_limits;
CREATE POLICY "credit_limits_insert_supervisor" ON public.credit_limits FOR INSERT WITH CHECK (
  public.current_user_role() IN ('supervisor', 'administrador')
);
