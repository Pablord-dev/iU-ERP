import { ClientForm } from '@/modules/clients/client-form'
import { createClientAction } from '@/modules/clients/actions'

export default function NewClientPage() {
  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Nuevo cliente</h1>
      <ClientForm action={createClientAction} />
    </div>
  )
}
