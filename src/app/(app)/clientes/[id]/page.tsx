import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/db'
import { requireCtx } from '@/lib/session'
import { getClient } from '@/modules/clients/service'
import { listProjects } from '@/modules/projects/service'
import { archiveClientAction } from '@/modules/clients/actions'
import { Button } from '@/components/ui/button'

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await requireCtx()
  const client = await getClient(db, ctx, id)
  if (!client) notFound()
  const projectRows = await listProjects(db, ctx, { clientId: client.id })
  return (
    <div className="max-w-2xl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{client.commercialName}</h1>
        <div className="flex gap-2">
          <Button variant="outline" asChild><Link href={`/clientes/${client.id}/editar`}>Editar</Link></Button>
          <form action={archiveClientAction.bind(null, client.id)}>
            <Button variant="destructive" type="submit">Archivar</Button>
          </form>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
        <div><dt className="text-gray-500">Razón social</dt><dd>{client.legalName ?? '—'}</dd></div>
        <div><dt className="text-gray-500">Contacto</dt><dd>{client.contactName ?? '—'}</dd></div>
        <div><dt className="text-gray-500">Correo</dt><dd>{client.email ?? '—'}</dd></div>
        <div><dt className="text-gray-500">Teléfono</dt><dd>{client.phone ?? '—'}</dd></div>
        <div><dt className="text-gray-500">Tarifa por hora</dt><dd>{client.hourlyRate ? `$${client.hourlyRate}` : '—'}</dd></div>
        <div><dt className="text-gray-500">Estado</dt><dd>{client.isActive ? 'Activo' : 'Inactivo'}</dd></div>
        <div className="col-span-2"><dt className="text-gray-500">Notas</dt><dd className="whitespace-pre-wrap">{client.notes ?? '—'}</dd></div>
      </dl>
      <section className="mt-6">
        <h2 className="mb-2 text-lg font-medium">Proyectos</h2>
        {projectRows.length === 0 ? (
          <p className="text-sm text-gray-400">Sin proyectos todavía.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {projectRows.map(({ project, status }) => (
              <li key={project.id}>
                <Link className="hover:underline" href={`/proyectos/${project.id}`}>{project.name}</Link>
                <span className="ml-2 text-gray-500">({status.name})</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
