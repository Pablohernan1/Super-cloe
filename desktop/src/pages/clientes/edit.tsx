import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { PageHeader } from '@/components/ui/page-header'
import { Spinner } from '@/components/ui/spinner'
import { CustomerForm } from './customer-form'

export default function EditCustomerPage() {
  const { id } = useParams<{ id: string }>()
  const [customer, setCustomer] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('customers').select('*').eq('id', id).single()
      setCustomer(data)
      setLoading(false)
    }
    load()
  }, [id])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner className="h-6 w-6" />
      </div>
    )
  }

  if (!customer) {
    return <div className="p-6 text-muted-foreground">Cliente no encontrado</div>
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
