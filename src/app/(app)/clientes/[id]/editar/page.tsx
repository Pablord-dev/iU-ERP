import { notFound } from 'next/navigation'
import { db } from '@/db'
import { requireCtx } from '@/lib/session'
import { getClient } from '@/modules/clients/service'
import { updateClientAction } from '@/modules/clients/actions'
import { ClientForm } from '@/modules/clients/client-form'

export default async function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await requireCtx()
  const client = await getClient(db, ctx, id)
  if (!client) notFound()
  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Editar cliente</h1>
      <ClientForm action={updateClientAction.bind(null, client.id)} client={client} />
    </div>
  )
}
