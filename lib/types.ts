// User roles
export type UserRole = 'cajero' | 'supervisor' | 'administrador'

// Account status
export type AccountStatus = 'active' | 'blocked' | 'pending_password_change'

// Customer status
export type CustomerStatus = 'active' | 'inactive' | 'blocked' | 'suspended'

// Guarantor relation status
export type GuarantorRelationStatus = 'active' | 'inactive'

// Loan status
export type LoanStatus = 'pending' | 'approved' | 'rejected' | 'active' | 'completed' | 'defaulted' | 'cancelled'

// Installment status
export type InstallmentStatus = 'pending' | 'paid' | 'partial' | 'overdue' | 'cancelled'

// Payment method
export type PaymentMethod = 'cash' | 'debit' | 'transfer' | 'discount'

// Alert type
export type AlertType = 'overdue' | 'limit_exceeded' | 'document_expired' | 'system'

// Alert priority
export type AlertPriority = 'low' | 'medium' | 'high' | 'critical'

// Audit action
export type AuditAction = 'create' | 'update' | 'delete' | 'login' | 'logout' | 'approve' | 'reject'

// Profile type
export interface Profile {
  id: string
  employee_code: string
  full_name: string
  role: UserRole
  status: AccountStatus
  email: string | null
  phone: string | null
  avatar_url: string | null
  failed_login_attempts: number
  last_login_at: string | null
  password_changed_at: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
}

// Customer type
export interface Customer {
  id: string
  customer_code: string | null
  person_type: 'fisica' | 'juridica'
  document_type: string
  document_number: string
  cuit_cuil: string | null
  first_name: string
  last_name: string
  razon_social: string | null
  fecha_constitucion: string | null
  birth_date: string | null
  phone: string | null
  phone_secondary: string | null
  email: string | null
  address: string | null
  city: string | null
  localidad: string | null
  provincia: string | null
  occupation: string | null
  employer: string | null
  monthly_income: number | null
  status: CustomerStatus
  notes: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
}

// Guarantor relation type (titular-garante; ambos son Customer)
export interface GuarantorRelation {
  id: string
  titular_customer_id: string
  guarantor_customer_id: string
  status: GuarantorRelationStatus
  observations: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
  // Relations
  titular?: Customer
  guarantor?: Customer
}

// Loan-guarantor link (1 o 2 garantes por préstamo)
export interface LoanGuarantor {
  loan_id: string
  guarantor_customer_id: string
  created_at: string
  guarantor?: Customer
}

// Credit limit status
export type CreditLimitStatus = 'pending_approval' | 'approved' | 'rejected' | 'suspended' | 'expired'

// Credit limit type
export interface CreditLimit {
  id: string
  customer_id: string
  approved_limit: number
  committed_limit: number
  available_credit: number
  status: CreditLimitStatus
  observations: string | null
  guarantors_required: number
  guarantors_active_count: number
  eligible_for_extension: boolean
  approved_by: string | null
  approved_at: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
  last_evaluation_date: string | null
  next_evaluation_date: string | null
  evaluation_notes: string | null
}

// Loan type
export interface Loan {
  id: string
  loan_number: string
  customer_id: string
  principal_amount: number
  interest_rate: number
  total_amount: number
  term_months: number
  installment_amount: number
  status: LoanStatus
  purpose: string | null
  disbursement_date: string | null
  first_due_date: string | null
  approved_at: string | null
  approved_by: string | null
  rejected_at: string | null
  rejected_by: string | null
  rejection_reason: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  // Relations
  customer?: Customer
  guarantors?: LoanGuarantor[]
}

// Installment type
export interface Installment {
  id: string
  loan_id: string
  installment_number: number
  due_date: string
  principal_amount: number
  interest_amount: number
  total_amount: number
  paid_amount: number
  penalty_amount: number
  status: InstallmentStatus
  paid_at: string | null
  created_at: string
  updated_at: string
  // Relations
  loan?: Loan
}

// Payment type
export interface Payment {
  id: string
  payment_number: string
  installment_id: string
  amount: number
  applied_penalty: number
  payment_method: PaymentMethod
  reference_number: string | null
  notes: string | null
  received_at: string
  created_at: string
  created_by: string | null
  // Relations
  installment?: Installment
}

// Alert type
export interface Alert {
  id: string
  alert_type: AlertType
  priority: AlertPriority
  title: string
  message: string
  reference_id: string | null
  reference_type: string | null
  is_read: boolean
  read_at: string | null
  read_by: string | null
  assigned_to: string | null
  created_at: string
}

// Audit log type
export interface AuditLog {
  id: string
  user_id: string | null
  action: AuditAction
  table_name: string | null
  record_id: string | null
  old_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
  ip_address: string | null
  user_agent: string | null
  created_at: string
}

// Parameter type
export interface Parameter {
  id: string
  key: string
  value: string
  description: string | null
  data_type: string
  is_active: boolean
  created_at: string
  updated_at: string
  updated_by: string | null
}

// Navigation item type for sidebar
export interface NavItem {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  badge?: number
  roles?: UserRole[]
  children?: NavItem[]
}

// Dashboard stats
export interface DashboardStats {
  totalCustomers: number
  activeLoans: number
  pendingApprovals: number
  overdueInstallments: number
  todayCollections: number
  monthlyCollections: number
}
