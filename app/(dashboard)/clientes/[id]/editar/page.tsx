import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/ui/page-header'
import { CustomerForm } from '../../customer-form'

interface EditCustomerPageProps {
  params: Promise<{ id: string }>
}

export default async function EditCustomerPage({ params }: EditCustomerPageProps) {
  const { id } = await params
  const supabase = await createClient()

  const { data: customer, error } = await supabase
    .from('customers')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !customer) {
    notFound()
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Editar Cliente"
        description={`${customer.first_name} ${customer.last_name} - ${customer.customer_code}`}
        backHref={`/clientes/${id}`}
      />
      <CustomerForm customer={customer} isEditing />
    </div>
  )
}
