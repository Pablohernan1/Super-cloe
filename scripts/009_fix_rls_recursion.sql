-- =====================================================================
-- Supermercado Cloe -- Arreglar recursión infinita en RLS
--
-- Probando con un usuario supervisor real se detectó: cualquier policy que
-- hace `EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND
-- role IN (...))` dispara la propia RLS de `profiles` al evaluar la
-- subconsulta, que a su vez vuelve a consultar profiles -> Postgres corta
-- con "infinite recursion detected in policy for relation profiles" (500).
-- Afectaba TODAS las policies de supervisor/admin (loans, credit_limits,
-- loan_guarantors, parameters, audit_logs) y las de profiles mismas.
--
-- Fix estándar: una función SECURITY DEFINER que lee el rol bypasseando RLS
-- (no hay vuelta a evaluar policies dentro de una función DEFINER), y las
-- policies llaman a esa función en vez de hacer la subconsulta inline.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS user_role
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- profiles
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_select_own_or_admin" ON public.profiles FOR SELECT USING (
  auth.uid() = id OR public.current_user_role() = 'administrador'
);
DROP POLICY IF EXISTS "profiles_update_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_update_own_or_admin" ON public.profiles FOR UPDATE USING (
  auth.uid() = id OR public.current_user_role() = 'administrador'
);

-- credit_limits
DROP POLICY IF EXISTS "credit_limits_update_supervisor" ON public.credit_limits;
CREATE POLICY "credit_limits_update_supervisor" ON public.credit_limits FOR UPDATE USING (
  public.current_user_role() IN ('supervisor', 'administrador')
);

-- loans
DROP POLICY IF EXISTS "loans_insert_supervisor" ON public.loans;
CREATE POLICY "loans_insert_supervisor" ON public.loans FOR INSERT WITH CHECK (
  public.current_user_role() IN ('supervisor', 'administrador')
);
DROP POLICY IF EXISTS "loans_update_supervisor" ON public.loans;
CREATE POLICY "loans_update_supervisor" ON public.loans FOR UPDATE USING (
  public.current_user_role() IN ('supervisor', 'administrador')
);

-- loan_guarantors
DROP POLICY IF EXISTS "loan_guarantors_insert_supervisor" ON public.loan_guarantors;
CREATE POLICY "loan_guarantors_insert_supervisor" ON public.loan_guarantors FOR INSERT WITH CHECK (
  public.current_user_role() IN ('supervisor', 'administrador')
);

-- parameters
DROP POLICY IF EXISTS "parameters_update_admin" ON public.parameters;
CREATE POLICY "parameters_update_admin" ON public.parameters FOR UPDATE USING (
  public.current_user_role() = 'administrador'
);

-- audit_logs
DROP POLICY IF EXISTS "audit_logs_select_admin" ON public.audit_logs;
CREATE POLICY "audit_logs_select_admin" ON public.audit_logs FOR SELECT USING (
  public.current_user_role() = 'administrador'
);
