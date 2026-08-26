-- Supermercado Cloe - Internal Financing System
-- Initial Database Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ENUM Types
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('cajero', 'supervisor', 'administrador');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE account_status AS ENUM ('active', 'blocked', 'pending_password_change');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE loan_status AS ENUM ('pending', 'approved', 'rejected', 'active', 'completed', 'defaulted', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE installment_status AS ENUM ('pending', 'paid', 'partial', 'overdue', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE payment_method AS ENUM ('cash', 'debit', 'transfer', 'discount');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE alert_type AS ENUM ('overdue', 'limit_exceeded', 'document_expired', 'system');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE alert_priority AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE audit_action AS ENUM ('create', 'update', 'delete', 'login', 'logout', 'approve', 'reject');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'cajero',
  status account_status NOT NULL DEFAULT 'active',
  avatar_url TEXT,
  phone TEXT,
  must_change_password BOOLEAN NOT NULL DEFAULT false,
  last_login_at TIMESTAMPTZ,
  failed_login_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_select_admin" ON public.profiles;
CREATE POLICY "profiles_select_admin" ON public.profiles FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'administrador')
);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
CREATE POLICY "profiles_update_admin" ON public.profiles FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'administrador')
);

-- CUSTOMERS TABLE
CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cuit_cuil TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  mobile_phone TEXT,
  address TEXT,
  city TEXT,
  province TEXT,
  postal_code TEXT,
  birth_date DATE,
  employer TEXT,
  employer_phone TEXT,
  monthly_income DECIMAL(12,2),
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.profiles(id),
  updated_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customers_select_authenticated" ON public.customers;
CREATE POLICY "customers_select_authenticated" ON public.customers FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "customers_insert_supervisor" ON public.customers;
CREATE POLICY "customers_insert_supervisor" ON public.customers FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('supervisor', 'administrador'))
);

DROP POLICY IF EXISTS "customers_update_supervisor" ON public.customers;
CREATE POLICY "customers_update_supervisor" ON public.customers FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('supervisor', 'administrador'))
);

-- GUARANTORS TABLE
CREATE TABLE IF NOT EXISTS public.guarantors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  cuit_cuil TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  relationship TEXT,
  phone TEXT,
  mobile_phone TEXT,
  address TEXT,
  employer TEXT,
  monthly_income DECIMAL(12,2),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.profiles(id),
  updated_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.guarantors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "guarantors_select_authenticated" ON public.guarantors;
CREATE POLICY "guarantors_select_authenticated" ON public.guarantors FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "guarantors_insert_supervisor" ON public.guarantors;
CREATE POLICY "guarantors_insert_supervisor" ON public.guarantors FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('supervisor', 'administrador'))
);

DROP POLICY IF EXISTS "guarantors_update_supervisor" ON public.guarantors;
CREATE POLICY "guarantors_update_supervisor" ON public.guarantors FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('supervisor', 'administrador'))
);

-- CREDIT LIMITS TABLE
CREATE TABLE IF NOT EXISTS public.credit_limits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  max_amount DECIMAL(12,2) NOT NULL,
  available_amount DECIMAL(12,2) NOT NULL,
  approved_by UUID REFERENCES public.profiles(id),
  approved_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.profiles(id),
  updated_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.credit_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "credit_limits_select_authenticated" ON public.credit_limits;
CREATE POLICY "credit_limits_select_authenticated" ON public.credit_limits FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "credit_limits_insert_admin" ON public.credit_limits;
CREATE POLICY "credit_limits_insert_admin" ON public.credit_limits FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'administrador')
);

DROP POLICY IF EXISTS "credit_limits_update_admin" ON public.credit_limits;
CREATE POLICY "credit_limits_update_admin" ON public.credit_limits FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'administrador')
);

-- LOANS TABLE
CREATE TABLE IF NOT EXISTS public.loans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loan_number TEXT NOT NULL UNIQUE,
  customer_id UUID NOT NULL REFERENCES public.customers(id),
  guarantor_id UUID REFERENCES public.guarantors(id),
  principal_amount DECIMAL(12,2) NOT NULL,
  interest_rate DECIMAL(5,2) NOT NULL,
  total_amount DECIMAL(12,2) NOT NULL,
  installments_count INTEGER NOT NULL,
  installment_amount DECIMAL(12,2) NOT NULL,
  status loan_status NOT NULL DEFAULT 'pending',
  approved_by UUID REFERENCES public.profiles(id),
  approved_at TIMESTAMPTZ,
  disbursed_at TIMESTAMPTZ,
  first_due_date DATE,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  updated_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "loans_select_authenticated" ON public.loans;
CREATE POLICY "loans_select_authenticated" ON public.loans FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "loans_insert_supervisor" ON public.loans;
CREATE POLICY "loans_insert_supervisor" ON public.loans FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('supervisor', 'administrador'))
);

DROP POLICY IF EXISTS "loans_update_supervisor" ON public.loans;
CREATE POLICY "loans_update_supervisor" ON public.loans FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('supervisor', 'administrador'))
);

-- INSTALLMENTS TABLE
CREATE TABLE IF NOT EXISTS public.installments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  installment_number INTEGER NOT NULL,
  due_date DATE NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  paid_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  status installment_status NOT NULL DEFAULT 'pending',
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT installments_unique_number UNIQUE (loan_id, installment_number)
);

ALTER TABLE public.installments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "installments_select_authenticated" ON public.installments;
CREATE POLICY "installments_select_authenticated" ON public.installments FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "installments_update_cajero" ON public.installments;
CREATE POLICY "installments_update_cajero" ON public.installments FOR UPDATE USING (auth.uid() IS NOT NULL);

-- PAYMENTS TABLE
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_number TEXT NOT NULL UNIQUE,
  installment_id UUID NOT NULL REFERENCES public.installments(id),
  amount DECIMAL(12,2) NOT NULL,
  payment_method payment_method NOT NULL,
  reference_number TEXT,
  notes TEXT,
  received_by UUID REFERENCES public.profiles(id),
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payments_select_authenticated" ON public.payments;
CREATE POLICY "payments_select_authenticated" ON public.payments FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "payments_insert_authenticated" ON public.payments;
CREATE POLICY "payments_insert_authenticated" ON public.payments FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ALERTS TABLE
CREATE TABLE IF NOT EXISTS public.alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type alert_type NOT NULL,
  priority alert_priority NOT NULL DEFAULT 'medium',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  customer_id UUID REFERENCES public.customers(id),
  loan_id UUID REFERENCES public.loans(id),
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_by UUID REFERENCES public.profiles(id),
  read_at TIMESTAMPTZ,
  is_dismissed BOOLEAN NOT NULL DEFAULT false,
  dismissed_by UUID REFERENCES public.profiles(id),
  dismissed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "alerts_select_authenticated" ON public.alerts;
CREATE POLICY "alerts_select_authenticated" ON public.alerts FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "alerts_update_authenticated" ON public.alerts;
CREATE POLICY "alerts_update_authenticated" ON public.alerts FOR UPDATE USING (auth.uid() IS NOT NULL);

-- PARAMETERS TABLE
CREATE TABLE IF NOT EXISTS public.parameters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  description TEXT,
  data_type TEXT NOT NULL DEFAULT 'string',
  is_active BOOLEAN NOT NULL DEFAULT true,
  updated_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.parameters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "parameters_select_authenticated" ON public.parameters;
CREATE POLICY "parameters_select_authenticated" ON public.parameters FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "parameters_update_admin" ON public.parameters;
CREATE POLICY "parameters_update_admin" ON public.parameters FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'administrador')
);

-- AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id),
  action audit_action NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_logs_select_admin" ON public.audit_logs;
CREATE POLICY "audit_logs_select_admin" ON public.audit_logs FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'administrador')
);

DROP POLICY IF EXISTS "audit_logs_insert_authenticated" ON public.audit_logs;
CREATE POLICY "audit_logs_insert_authenticated" ON public.audit_logs FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_customers_cuit_cuil ON public.customers(cuit_cuil);
CREATE INDEX IF NOT EXISTS idx_customers_last_name ON public.customers(last_name);
CREATE INDEX IF NOT EXISTS idx_loans_customer_id ON public.loans(customer_id);
CREATE INDEX IF NOT EXISTS idx_loans_status ON public.loans(status);
CREATE INDEX IF NOT EXISTS idx_installments_loan_id ON public.installments(loan_id);
CREATE INDEX IF NOT EXISTS idx_installments_due_date ON public.installments(due_date);
CREATE INDEX IF NOT EXISTS idx_installments_status ON public.installments(status);
CREATE INDEX IF NOT EXISTS idx_payments_installment_id ON public.payments(installment_id);
CREATE INDEX IF NOT EXISTS idx_alerts_customer_id ON public.alerts(customer_id);
CREATE INDEX IF NOT EXISTS idx_alerts_is_read ON public.alerts(is_read);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type ON public.audit_logs(entity_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at);
