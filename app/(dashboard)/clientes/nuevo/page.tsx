import { PageHeader } from '@/components/ui/page-header'
import { CustomerForm } from '../customer-form'

export default function NewCustomerPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Nuevo Cliente"
        description="Registrar un nuevo cliente en el sistema"
        backHref="/clientes"
      />
      <CustomerForm />
    </div>
  )
}
