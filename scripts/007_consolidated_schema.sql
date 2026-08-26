-- =====================================================================
-- Supermercado Cloe - Financiación propia
-- Migración consolidada (reemplaza 001, 003, 004, 005, 006 y el estado
-- ad-hoc de la base real). Ver .claude/skills/cloe-financiacion/SKILL.md
-- para la auditoría completa que motiva estos cambios.
--
-- Seguro de re-ejecutar: usa DROP ... IF EXISTS / CREATE OR REPLACE en
-- todos lados. No hay datos de producción que preservar (confirmado).
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================================
-- 1. ENUMS
-- =====================================================================

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('cajero', 'supervisor', 'administrador');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE account_status AS ENUM ('active', 'blocked', 'pending_password_change');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE customer_status AS ENUM ('active', 'inactive', 'blocked', 'suspended');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE guarantor_relation_status AS ENUM ('active', 'inactive');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE credit_limit_status AS ENUM ('pending_approval', 'approved', 'rejected', 'suspended', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE loan_status AS ENUM ('pending', 'approved', 'rejected', 'active', 'completed', 'defaulted', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE installment_status AS ENUM ('pending', 'paid', 'partial', 'overdue', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payment_method AS ENUM ('cash', 'debit', 'transfer', 'discount');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE alert_type AS ENUM ('overdue', 'limit_exceeded', 'document_expired', 'system');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE alert_priority AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE audit_action AS ENUM ('create', 'update', 'delete', 'login', 'logout', 'approve', 'reject');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =====================================================================
-- 1.5. RESET de tablas de negocio existentes
-- Ya existen en la base real con estructura vieja/parcial (ver auditoría
-- en SKILL.md) y solo tienen datos de prueba (confirmado, no hay
-- producción) -- CREATE TABLE IF NOT EXISTS no alcanzaría a corregirlas,
-- así que se recrean desde cero. profiles y parameters se conservan
-- (su estructura real ya coincide con la deseada).
-- =====================================================================

DROP TABLE IF EXISTS public.audit_logs CASCADE;
DROP TABLE IF EXISTS public.payments CASCADE;
DROP TABLE IF EXISTS public.alerts CASCADE;
DROP TABLE IF EXISTS public.installments CASCADE;
DROP TABLE IF EXISTS public.loan_guarantors CASCADE;
DROP TABLE IF EXISTS public.loans CASCADE;
DROP TABLE IF EXISTS public.credit_limits CASCADE;
DROP TABLE IF EXISTS public.guarantor_relations CASCADE;
DROP TABLE IF EXISTS public.guarantors CASCADE;
DROP TABLE IF EXISTS public.customers CASCADE;

-- =====================================================================
-- 2. TABLAS BASE (sin dependencias de negocio)
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_code VARCHAR(20) UNIQUE,
  email VARCHAR(255),
  full_name VARCHAR(200) NOT NULL,
  role user_role NOT NULL DEFAULT 'cajero',
  status account_status NOT NULL DEFAULT 'active',
  avatar_url TEXT,
  phone VARCHAR(30),
  failed_login_attempts INTEGER NOT NULL DEFAULT 0,
  last_login_at TIMESTAMPTZ,
  password_changed_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles(id),
  updated_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.parameters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(100) NOT NULL UNIQUE,
  value TEXT NOT NULL,
  description TEXT,
  data_type VARCHAR(20) NOT NULL DEFAULT 'string',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES public.profiles(id)
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id),
  action audit_action NOT NULL,
  table_name VARCHAR(100),
  record_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================================
-- 3. CLIENTES
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_code VARCHAR(30) UNIQUE,
  person_type VARCHAR(10) NOT NULL DEFAULT 'fisica' CHECK (person_type IN ('fisica', 'juridica')),
  document_type VARCHAR(10) NOT NULL DEFAULT 'CUIT',
  document_number VARCHAR(20) NOT NULL,
  cuit_cuil VARCHAR(13),
  first_name VARCHAR(150) NOT NULL DEFAULT '',
  last_name VARCHAR(150) NOT NULL DEFAULT '',
  razon_social VARCHAR(200),
  fecha_constitucion DATE,
  birth_date DATE,
  phone VARCHAR(30),
  phone_secondary VARCHAR(30),
  email VARCHAR(255),
  address TEXT,
  city VARCHAR(100),
  localidad VARCHAR(100),
  provincia VARCHAR(100),
  occupation VARCHAR(150),
  employer VARCHAR(150),
  monthly_income NUMERIC(14, 2),
  status customer_status NOT NULL DEFAULT 'active',
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  updated_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT customers_document_number_unique UNIQUE (document_number)
);

CREATE INDEX IF NOT EXISTS idx_customers_document_number ON public.customers(document_number);
CREATE INDEX IF NOT EXISTS idx_customers_status ON public.customers(status);
CREATE INDEX IF NOT EXISTS idx_customers_last_name ON public.customers(last_name);

-- =====================================================================
-- 4. GARANTES (relación titular-garante; ambos son customers)
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.guarantor_relations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titular_customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  guarantor_customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  status guarantor_relation_status NOT NULL DEFAULT 'active',
  observations TEXT,
  created_by UUID REFERENCES public.profiles(id),
  updated_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT guarantor_relations_no_self CHECK (titular_customer_id <> guarantor_customer_id),
  CONSTRAINT guarantor_relations_unique UNIQUE (titular_customer_id, guarantor_customer_id)
);

CREATE INDEX IF NOT EXISTS idx_guarantor_relations_titular ON public.guarantor_relations(titular_customer_id);
CREATE INDEX IF NOT EXISTS idx_guarantor_relations_guarantor ON public.guarantor_relations(guarantor_customer_id);

-- La tabla vieja de garantes en texto libre (guarantors) y la FK
-- loans.guarantor_id que apuntaba a ella ya se eliminaron en el bloque de
-- reset de arriba; se reemplazan por guarantor_relations + loan_guarantors.

-- =====================================================================
-- 5. LÍMITES DE CRÉDITO
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.credit_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL UNIQUE REFERENCES public.customers(id) ON DELETE CASCADE,
  approved_limit NUMERIC(14, 2) NOT NULL CHECK (approved_limit >= 0),
  committed_limit NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (committed_limit >= 0),
  available_credit NUMERIC(14, 2) GENERATED ALWAYS AS (GREATEST(approved_limit - committed_limit, 0)) STORED,
  status credit_limit_status NOT NULL DEFAULT 'pending_approval',
  observations TEXT,
  guarantors_required INTEGER NOT NULL DEFAULT 1,
  guarantors_active_count INTEGER NOT NULL DEFAULT 0,
  eligible_for_extension BOOLEAN NOT NULL DEFAULT false,
  approved_by UUID REFERENCES public.profiles(id),
  approved_at TIMESTAMPTZ,
  last_evaluation_date TIMESTAMPTZ,
  next_evaluation_date TIMESTAMPTZ,
  evaluation_notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  updated_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_limits_customer ON public.credit_limits(customer_id);

-- =====================================================================
-- 6. PRÉSTAMOS, GARANTES POR PRÉSTAMO Y CUOTAS
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_number VARCHAR(30) NOT NULL UNIQUE,
  customer_id UUID NOT NULL REFERENCES public.customers(id),
  principal_amount NUMERIC(14, 2) NOT NULL CHECK (principal_amount > 0),
  interest_rate NUMERIC(6, 4) NOT NULL,
  total_amount NUMERIC(14, 2) NOT NULL,
  term_months INTEGER NOT NULL CHECK (term_months > 0),
  installment_amount NUMERIC(14, 2) NOT NULL,
  status loan_status NOT NULL DEFAULT 'pending',
  purpose TEXT,
  disbursement_date DATE,
  first_due_date DATE,
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES public.profiles(id),
  rejected_at TIMESTAMPTZ,
  rejected_by UUID REFERENCES public.profiles(id),
  rejection_reason TEXT,
  created_by UUID REFERENCES public.profiles(id),
  updated_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loans_customer ON public.loans(customer_id);
CREATE INDEX IF NOT EXISTS idx_loans_status ON public.loans(status);

-- Un préstamo puede tener 1 o 2 garantes (spec 8.2). Tabla puente en vez de
-- la FK única loans.guarantor_id que había antes (no podía representar 2).
CREATE TABLE IF NOT EXISTS public.loan_guarantors (
  loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  guarantor_customer_id UUID NOT NULL REFERENCES public.customers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (loan_id, guarantor_customer_id)
);

CREATE TABLE IF NOT EXISTS public.installments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  installment_number INTEGER NOT NULL,
  due_date DATE NOT NULL,
  principal_amount NUMERIC(14, 2) NOT NULL,
  interest_amount NUMERIC(14, 2) NOT NULL,
  total_amount NUMERIC(14, 2) NOT NULL,
  paid_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  penalty_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  status installment_status NOT NULL DEFAULT 'pending',
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT installments_unique_number UNIQUE (loan_id, installment_number)
);

CREATE INDEX IF NOT EXISTS idx_installments_loan ON public.installments(loan_id);
CREATE INDEX IF NOT EXISTS idx_installments_due_date ON public.installments(due_date);
CREATE INDEX IF NOT EXISTS idx_installments_status ON public.installments(status);

-- =====================================================================
-- 7. PAGOS Y ALERTAS
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_number VARCHAR(30) NOT NULL UNIQUE,
  installment_id UUID NOT NULL REFERENCES public.installments(id),
  amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  applied_penalty NUMERIC(14, 2) NOT NULL DEFAULT 0,
  payment_method payment_method NOT NULL,
  reference_number VARCHAR(60),
  notes TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES public.profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_payments_installment ON public.payments(installment_id);
CREATE INDEX IF NOT EXISTS idx_payments_received_at ON public.payments(received_at);

CREATE TABLE IF NOT EXISTS public.alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type alert_type NOT NULL,
  priority alert_priority NOT NULL DEFAULT 'medium',
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  reference_id UUID,
  reference_type VARCHAR(30),
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,
  read_by UUID REFERENCES public.profiles(id),
  assigned_to UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_is_read ON public.alerts(is_read);
CREATE INDEX IF NOT EXISTS idx_alerts_reference ON public.alerts(reference_type, reference_id);

CREATE SEQUENCE IF NOT EXISTS public.payment_number_seq START 1;

-- =====================================================================
-- 8. TRIGGERS DE MANTENIMIENTO GENÉRICO (updated_at)
-- =====================================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['profiles','parameters','customers','guarantor_relations','credit_limits','loans','installments']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_set_updated_at ON public.%I', t);
    EXECUTE format('CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t);
  END LOOP;
END $$;

-- Alta automática de profile cuando se crea un usuario en auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, status, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'cajero',
    'active',
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================================
-- 9. PARÁMETROS (spec sección 12)
-- =====================================================================

INSERT INTO public.parameters (key, value, description, data_type) VALUES
  ('interest_rate_1_installment', '0.15', 'Tasa directa para 1 cuota (spec 9)', 'number'),
  ('interest_rate_2_installments', '0.25', 'Tasa directa para 2 cuotas (spec 9)', 'number'),
  ('interest_rate_3_installments', '0.30', 'Tasa directa para 3 cuotas (spec 9)', 'number'),
  ('max_installments', '3', 'Máximo de cuotas permitido por préstamo', 'number'),
  ('min_loan_amount', '1000', 'Monto mínimo de préstamo', 'number'),
  ('max_loan_amount', '500000', 'Monto máximo de préstamo', 'number'),
  ('mora_grace_period_days', '5', 'Días de gracia antes de considerar mora bloqueante', 'number'),
  ('mora_daily_penalty_rate_pct', '0.5', 'Interés de mora diario (%) sobre el saldo vencido de la cuota', 'number'),
  ('rehabilitation_mode', 'overdue_installments_plus_penalty', 'Condición para rehabilitar: regularizar cuotas vencidas + interés de mora acumulado', 'string'),
  ('credit_limit_base_1_guarantor', '100000', 'Límite base sugerido con 1 garante válido', 'number'),
  ('credit_limit_additional_2_guarantors', '100000', 'Adicional sugerido al límite base con 2 garantes válidos', 'number'),
  ('max_guarantors_per_titular', '2', 'Máximo de garantes activos por titular', 'number'),
  ('max_titulares_per_guarantor', '3', 'Máximo de titulares simultáneos que puede respaldar un garante', 'number'),
  ('max_loans_per_customer', '3', 'Máximo de préstamos vigentes simultáneos por cliente', 'number'),
  ('max_loans_guaranteed_per_guarantor', '3', 'Máximo de préstamos que puede respaldar un mismo garante', 'number'),
  ('max_failed_logins', '3', 'Intentos fallidos antes de bloquear el usuario interno', 'number'),
  ('session_timeout_minutes', '30', 'Minutos de inactividad antes de cerrar sesión', 'number')
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  data_type = EXCLUDED.data_type;

CREATE OR REPLACE FUNCTION public.get_parameter_numeric(p_key TEXT, p_default NUMERIC)
RETURNS NUMERIC AS $$
DECLARE
  v_value TEXT;
BEGIN
  SELECT value INTO v_value FROM public.parameters WHERE key = p_key AND is_active = true;
  IF v_value IS NULL THEN
    RETURN p_default;
  END IF;
  RETURN v_value::NUMERIC;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION public.get_parameter_text(p_key TEXT, p_default TEXT)
RETURNS TEXT AS $$
DECLARE
  v_value TEXT;
BEGIN
  SELECT value INTO v_value FROM public.parameters WHERE key = p_key AND is_active = true;
  RETURN COALESCE(v_value, p_default);
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================================
-- 10. GARANTES: topes (spec 8.2)
-- =====================================================================

CREATE OR REPLACE FUNCTION public.enforce_guarantor_limits()
RETURNS TRIGGER AS $$
DECLARE
  v_active_for_titular INT;
  v_active_for_guarantor INT;
  v_guarantor_status customer_status;
  v_max_guarantors INT;
  v_max_titulares INT;
BEGIN
  IF NEW.status <> 'active' THEN
    RETURN NEW;
  END IF;

  SELECT status INTO v_guarantor_status FROM public.customers WHERE id = NEW.guarantor_customer_id;
  IF v_guarantor_status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'El garante no está activo como cliente del supermercado (estado: %)', v_guarantor_status;
  END IF;

  v_max_guarantors := public.get_parameter_numeric('max_guarantors_per_titular', 2);
  SELECT COUNT(*) INTO v_active_for_titular
  FROM public.guarantor_relations
  WHERE titular_customer_id = NEW.titular_customer_id
    AND status = 'active'
    AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

  IF v_active_for_titular >= v_max_guarantors THEN
    RAISE EXCEPTION 'El titular ya tiene el máximo de % garante(s) activo(s) permitido', v_max_guarantors;
  END IF;

  v_max_titulares := public.get_parameter_numeric('max_titulares_per_guarantor', 3);
  SELECT COUNT(*) INTO v_active_for_guarantor
  FROM public.guarantor_relations
  WHERE guarantor_customer_id = NEW.guarantor_customer_id
    AND status = 'active'
    AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

  IF v_active_for_guarantor >= v_max_titulares THEN
    RAISE EXCEPTION 'Este garante ya respalda el máximo de % titular(es) simultáneo(s) permitido', v_max_titulares;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_guarantor_limits ON public.guarantor_relations;
CREATE TRIGGER trg_enforce_guarantor_limits
  BEFORE INSERT OR UPDATE ON public.guarantor_relations
  FOR EACH ROW EXECUTE FUNCTION public.enforce_guarantor_limits();

-- Mantiene credit_limits.guarantors_active_count / eligible_for_extension
-- sincronizado con la cantidad real de garantes activos del titular.
CREATE OR REPLACE FUNCTION public.sync_guarantor_count()
RETURNS TRIGGER AS $$
DECLARE
  v_titular UUID;
  v_count INT;
BEGIN
  v_titular := COALESCE(NEW.titular_customer_id, OLD.titular_customer_id);

  SELECT COUNT(*) INTO v_count
  FROM public.guarantor_relations
  WHERE titular_customer_id = v_titular AND status = 'active';

  UPDATE public.credit_limits
  SET guarantors_active_count = v_count,
      guarantors_required = CASE WHEN v_count >= 2 THEN 2 ELSE 1 END,
      eligible_for_extension = (v_count >= 2)
  WHERE customer_id = v_titular;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_guarantor_count ON public.guarantor_relations;
CREATE TRIGGER trg_sync_guarantor_count
  AFTER INSERT OR UPDATE OR DELETE ON public.guarantor_relations
  FOR EACH ROW EXECUTE FUNCTION public.sync_guarantor_count();

-- =====================================================================
-- 11. PRÉSTAMOS: creación atómica con validaciones críticas (spec 5, 6, 8)
-- =====================================================================

CREATE OR REPLACE FUNCTION public.create_loan(
  p_customer_id UUID,
  p_principal_amount NUMERIC,
  p_term_months INT,
  p_guarantor_ids UUID[],
  p_purpose TEXT,
  p_user_id UUID
) RETURNS JSONB AS $$
DECLARE
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

  -- Garantes válidos: deben existir como clientes activos y estar
  -- efectivamente vinculados como garante activo del titular.
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

  -- Tasa directa según cuotas (spec 8.4 / 9)
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
    CURRENT_DATE, (CURRENT_DATE + INTERVAL '1 month')::date, NOW(), p_user_id, p_user_id
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
      updated_by = p_user_id
  WHERE id = v_credit_limit.id;

  INSERT INTO public.audit_logs (user_id, action, table_name, record_id, old_values, new_values)
  VALUES (p_user_id, 'create', 'loans', v_loan.id, NULL, jsonb_build_object(
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

-- Libera crédito comprometido cuando un préstamo se cancela
CREATE OR REPLACE FUNCTION public.release_credit_on_loan_close()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status <> 'cancelled' THEN
    UPDATE public.credit_limits
    SET committed_limit = GREATEST(committed_limit - NEW.total_amount, 0)
    WHERE customer_id = NEW.customer_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_release_credit_on_loan_close ON public.loans;
CREATE TRIGGER trg_release_credit_on_loan_close
  AFTER UPDATE OF status ON public.loans
  FOR EACH ROW EXECUTE FUNCTION public.release_credit_on_loan_close();

-- =====================================================================
-- 12. MORA, BLOQUEO Y REHABILITACIÓN (spec 8.5, 8.2, pantallas G y H)
-- =====================================================================

CREATE OR REPLACE FUNCTION public.refresh_mora_and_blocks()
RETURNS JSONB AS $$
DECLARE
  v_grace_days INT;
  v_daily_rate NUMERIC;
  v_loan RECORD;
  v_days_overdue INT;
  v_priority alert_priority;
  v_newly_blocked INT := 0;
  v_installments_flagged INT := 0;
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

  -- Recalcular penalty también para las que ya estaban 'overdue' (interés corre día a día)
  UPDATE public.installments i
  SET penalty_amount = ROUND((i.total_amount - i.paid_amount) * (v_daily_rate / 100.0) * (CURRENT_DATE - i.due_date), 2)
  WHERE i.status = 'overdue' AND (i.total_amount - i.paid_amount) > 0;

  -- 2) Préstamos con mora bloqueante -> bloquear titular + garantes, alertar
  FOR v_loan IN
    SELECT l.id AS loan_id, l.customer_id, l.loan_number,
           MAX(CURRENT_DATE - i.due_date) AS max_days_overdue,
           SUM(i.total_amount - i.paid_amount + i.penalty_amount) AS saldo
    FROM public.loans l
    JOIN public.installments i ON i.loan_id = l.id
    WHERE l.status IN ('active', 'approved', 'defaulted')
      AND i.status = 'overdue'
      AND (CURRENT_DATE - i.due_date) > v_grace_days
    GROUP BY l.id, l.customer_id, l.loan_number
  LOOP
    UPDATE public.loans SET status = 'defaulted' WHERE id = v_loan.loan_id AND status <> 'defaulted';

    IF NOT EXISTS (
      SELECT 1 FROM public.customers WHERE id = v_loan.customer_id AND status = 'blocked'
    ) THEN
      UPDATE public.customers SET status = 'blocked' WHERE id = v_loan.customer_id;
      v_newly_blocked := v_newly_blocked + 1;
      INSERT INTO public.audit_logs (action, table_name, record_id, old_values, new_values)
      VALUES ('update', 'customers', v_loan.customer_id, jsonb_build_object('status', 'active'),
              jsonb_build_object('status', 'blocked', 'reason', 'mora', 'loan_id', v_loan.loan_id));

      -- Bloquear también a los garantes activos de este titular
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

    v_priority := CASE
      WHEN v_loan.max_days_overdue >= 30 THEN 'critical'
      WHEN v_loan.max_days_overdue >= 14 THEN 'high'
      ELSE 'medium'
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
  END LOOP;

  -- 3) Préstamos que se regularizaron (sin cuotas overdue) vuelven a 'active'
  UPDATE public.loans l
  SET status = 'active'
  WHERE l.status = 'defaulted'
    AND NOT EXISTS (SELECT 1 FROM public.installments i WHERE i.loan_id = l.id AND i.status = 'overdue');

  RETURN jsonb_build_object(
    'installments_flagged', v_installments_flagged,
    'customers_newly_blocked', v_newly_blocked,
    'run_at', NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Registrar un pago: imputa primero a interés de mora, luego a la cuota.
CREATE OR REPLACE FUNCTION public.register_payment(
  p_installment_id UUID,
  p_amount NUMERIC,
  p_payment_method payment_method,
  p_reference_number TEXT,
  p_notes TEXT,
  p_user_id UUID
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
    v_payment_number, p_installment_id, p_amount, v_to_penalty, p_payment_method, p_reference_number, p_notes, NOW(), p_user_id
  );

  INSERT INTO public.audit_logs (user_id, action, table_name, record_id, new_values)
  VALUES (p_user_id, 'create', 'payments', p_installment_id, jsonb_build_object(
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

  RETURN jsonb_build_object(
    'success', true,
    'payment_number', v_payment_number,
    'applied_penalty', v_to_penalty,
    'applied_installment', v_to_installment,
    'installment_status', v_new_status
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Rehabilitación: exige que ya no queden cuotas vencidas del titular
-- (se regularizan antes vía register_payment) y desbloquea titular +
-- garantes que no tengan mora propia por otro lado.
CREATE OR REPLACE FUNCTION public.rehabilitate_customer(
  p_customer_id UUID,
  p_user_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_customer public.customers%ROWTYPE;
  v_pending_amount NUMERIC;
  v_guarantor RECORD;
  v_has_own_default BOOLEAN;
  v_unblocked UUID[] := ARRAY[]::UUID[];
BEGIN
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
  VALUES (p_user_id, 'update', 'customers', p_customer_id, jsonb_build_object('status', 'blocked'),
          jsonb_build_object('status', 'active', 'reason', 'rehabilitacion'));

  -- Desbloquear garantes de este titular, salvo que ellos mismos tengan
  -- un préstamo propio en mora (como titulares) que los mantenga bloqueados.
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
      VALUES (p_user_id, 'update', 'customers', v_guarantor.guarantor_customer_id, jsonb_build_object('status', 'blocked'),
              jsonb_build_object('status', 'active', 'reason', 'rehabilitacion_titular', 'titular_customer_id', p_customer_id));
    END IF;
  END LOOP;

  UPDATE public.alerts
  SET is_read = true, read_at = NOW(), read_by = p_user_id
  WHERE reference_type = 'loan' AND is_read = false
    AND reference_id IN (SELECT id FROM public.loans WHERE customer_id = p_customer_id);

  RETURN jsonb_build_object('success', true, 'unblocked_customer_ids', to_jsonb(v_unblocked));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =====================================================================
-- 13. ROW LEVEL SECURITY
-- =====================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guarantor_relations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_guarantors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parameters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- profiles
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_select_own_or_admin" ON public.profiles FOR SELECT USING (
  auth.uid() = id OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'administrador')
);
DROP POLICY IF EXISTS "profiles_update_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_update_own_or_admin" ON public.profiles FOR UPDATE USING (
  auth.uid() = id OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'administrador')
);

-- customers: cualquier rol autenticado busca/da de alta/edita (spec paso 1)
DROP POLICY IF EXISTS "customers_select_authenticated" ON public.customers;
CREATE POLICY "customers_select_authenticated" ON public.customers FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "customers_write_authenticated" ON public.customers;
CREATE POLICY "customers_write_authenticated" ON public.customers FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "customers_update_authenticated" ON public.customers;
CREATE POLICY "customers_update_authenticated" ON public.customers FOR UPDATE USING (auth.uid() IS NOT NULL);

-- guarantor_relations: cualquier rol autenticado (parte del alta de cliente)
DROP POLICY IF EXISTS "guarantor_relations_select" ON public.guarantor_relations;
CREATE POLICY "guarantor_relations_select" ON public.guarantor_relations FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "guarantor_relations_insert" ON public.guarantor_relations;
CREATE POLICY "guarantor_relations_insert" ON public.guarantor_relations FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "guarantor_relations_update" ON public.guarantor_relations;
CREATE POLICY "guarantor_relations_update" ON public.guarantor_relations FOR UPDATE USING (auth.uid() IS NOT NULL);

-- credit_limits: cajero puede ver y proponer; aprobar/rechazar/editar solo supervisor+
DROP POLICY IF EXISTS "credit_limits_select" ON public.credit_limits;
CREATE POLICY "credit_limits_select" ON public.credit_limits FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "credit_limits_insert" ON public.credit_limits;
CREATE POLICY "credit_limits_insert" ON public.credit_limits FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "credit_limits_update_supervisor" ON public.credit_limits;
CREATE POLICY "credit_limits_update_supervisor" ON public.credit_limits FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('supervisor', 'administrador'))
);

-- loans: confirmar préstamo restringido a supervisor+ (spec 4, 8.6)
DROP POLICY IF EXISTS "loans_select" ON public.loans;
CREATE POLICY "loans_select" ON public.loans FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "loans_insert_supervisor" ON public.loans;
CREATE POLICY "loans_insert_supervisor" ON public.loans FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('supervisor', 'administrador'))
);
DROP POLICY IF EXISTS "loans_update_supervisor" ON public.loans;
CREATE POLICY "loans_update_supervisor" ON public.loans FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('supervisor', 'administrador'))
);

DROP POLICY IF EXISTS "loan_guarantors_select" ON public.loan_guarantors;
CREATE POLICY "loan_guarantors_select" ON public.loan_guarantors FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "loan_guarantors_insert_supervisor" ON public.loan_guarantors;
CREATE POLICY "loan_guarantors_insert_supervisor" ON public.loan_guarantors FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('supervisor', 'administrador'))
);

-- installments: lectura para todos; las escrituras pasan por register_payment/
-- refresh_mora_and_blocks (SECURITY DEFINER), no hay policy de UPDATE directa.
DROP POLICY IF EXISTS "installments_select" ON public.installments;
CREATE POLICY "installments_select" ON public.installments FOR SELECT USING (auth.uid() IS NOT NULL);

-- payments: lectura para todos; los inserts solo vía register_payment (DEFINER)
DROP POLICY IF EXISTS "payments_select" ON public.payments;
CREATE POLICY "payments_select" ON public.payments FOR SELECT USING (auth.uid() IS NOT NULL);

-- alerts: cualquier rol autenticado ve y marca como leídas
DROP POLICY IF EXISTS "alerts_select" ON public.alerts;
CREATE POLICY "alerts_select" ON public.alerts FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "alerts_update" ON public.alerts;
CREATE POLICY "alerts_update" ON public.alerts FOR UPDATE USING (auth.uid() IS NOT NULL);

-- parameters: lectura para todos, edición solo administrador (spec 4, 12)
DROP POLICY IF EXISTS "parameters_select" ON public.parameters;
CREATE POLICY "parameters_select" ON public.parameters FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "parameters_update_admin" ON public.parameters;
CREATE POLICY "parameters_update_admin" ON public.parameters FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'administrador')
);

-- audit_logs: cualquier autenticado inserta (createAuditLog corre con su sesión);
-- solo administrador puede leer el historial completo.
DROP POLICY IF EXISTS "audit_logs_select_admin" ON public.audit_logs;
CREATE POLICY "audit_logs_select_admin" ON public.audit_logs FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'administrador')
);
DROP POLICY IF EXISTS "audit_logs_insert_authenticated" ON public.audit_logs;
CREATE POLICY "audit_logs_insert_authenticated" ON public.audit_logs FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- =====================================================================
-- Fin de la migración consolidada
-- =====================================================================
