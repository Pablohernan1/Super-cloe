-- Update customers table to support persona fisica/juridica
-- Add new columns for enhanced customer management

-- Add new columns
ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS person_type VARCHAR(10) DEFAULT 'fisica' CHECK (person_type IN ('fisica', 'juridica')),
ADD COLUMN IF NOT EXISTS cuit_cuil VARCHAR(13),
ADD COLUMN IF NOT EXISTS razon_social VARCHAR(200),
ADD COLUMN IF NOT EXISTS fecha_constitucion DATE,
ADD COLUMN IF NOT EXISTS provincia VARCHAR(100),
ADD COLUMN IF NOT EXISTS localidad VARCHAR(100),
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'blocked', 'defaulted'));

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_customers_cuit_cuil ON public.customers(cuit_cuil);
CREATE INDEX IF NOT EXISTS idx_customers_status ON public.customers(status);
CREATE INDEX IF NOT EXISTS idx_customers_person_type ON public.customers(person_type);

-- Add unique constraint on cuit_cuil (if not null)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'customers_cuit_cuil_unique'
  ) THEN
    ALTER TABLE public.customers ADD CONSTRAINT customers_cuit_cuil_unique UNIQUE (cuit_cuil);
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Update existing records to have default status if null
UPDATE public.customers SET status = 'active' WHERE status IS NULL;
UPDATE public.customers SET person_type = 'fisica' WHERE person_type IS NULL;

-- Rename address to domicilio for consistency (keep both for backwards compatibility)
-- ALTER TABLE public.customers RENAME COLUMN address TO domicilio;

-- Create audit_logs table if not exists
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action VARCHAR(50) NOT NULL,
  table_name VARCHAR(100),
  record_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for audit_logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_name ON public.audit_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_record_id ON public.audit_logs(record_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at);

-- Enable RLS on audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Audit logs policy - only admins can read all, users can read their own
CREATE POLICY IF NOT EXISTS "Users can view their own audit logs"
  ON public.audit_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Admins can view all audit logs"
  ON public.audit_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'administrador'
    )
  );

-- Everyone authenticated can insert audit logs
CREATE POLICY IF NOT EXISTS "Authenticated users can insert audit logs"
  ON public.audit_logs FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
