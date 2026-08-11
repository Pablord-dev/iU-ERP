import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/db'
import { requireCtx } from '@/lib/session'
import { getProjectDetail } from '@/modules/projects/service'
import { getClient } from '@/modules/clients/service'
import { archiveProjectAction } from '@/modules/projects/actions'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

const PRIORITY_LABELS: Record<string, string> = { low: 'Baja', medium: 'Media', high: 'Alta', urgent: 'Urgente' }

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await requireCtx()
  const detail = await getProjectDetail(db, ctx, id)
  if (!detail) notFound()
  const { project, clientName, status, health, responsibleName, members } = detail
  // La ficha del cliente excluye archivados: enlazar a ciegas llevaría a un 404.
  const clientIsLive = (await getClient(db, ctx, project.clientId)) !== null
  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{project.name}</h1>
          {clientIsLive ? (
            <Link className="text-sm text-gray-500 hover:underline" href={`/clientes/${project.clientId}`}>{clientName}</Link>
          ) : (
            <p className="text-sm text-gray-500">{clientName} (archivado)</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild><Link href={`/proyectos/${project.id}/editar`}>Editar</Link></Button>
          <form action={archiveProjectAction.bind(null, project.id)}>
            <Button variant="destructive" type="submit">Archivar</Button>
          </form>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Badge style={status.color ? { backgroundColor: status.color } : undefined}>{status.name}</Badge>
        {health && <Badge variant="outline">{health.name}</Badge>}
        <Badge variant="secondary">{PRIORITY_LABELS[project.priority]}</Badge>
      </div>
      <dl className="grid grid-cols-3 gap-x-8 gap-y-3 text-sm">
        <div><dt className="text-gray-500">Responsable</dt><dd>{responsibleName}</dd></div>
        <div><dt className="text-gray-500">Inicio</dt><dd>{project.startDate ?? '—'}</dd></div>
        <div><dt className="text-gray-500">Compromiso</dt><dd>{project.dueDate ?? '—'}</dd></div>
        <div><dt className="text-gray-500">Horas presupuestadas</dt><dd>{project.budgetedHours ?? '—'}</dd></div>
        <div><dt className="text-gray-500">Tarifa</dt><dd>{project.hourlyRate ? `$${project.hourlyRate}` : 'La del cliente'}</dd></div>
        <div><dt className="text-gray-500">Participantes</dt><dd>{members.length ? members.map((m) => m.name).join(', ') : '—'}</dd></div>
        {project.description && (
          <div className="col-span-3"><dt className="text-gray-500">Descripción</dt><dd className="whitespace-pre-wrap">{project.description}</dd></div>
        )}
      </dl>
      <Separator />
      <section id="subproyectos">
        <h2 className="mb-2 text-lg font-medium">Subproyectos</h2>
        <p className="text-sm text-gray-400">Se habilitan en la Task 8.</p>
      </section>
      <section id="hitos">
        <h2 className="mb-2 text-lg font-medium">Hitos</h2>
        <p className="text-sm text-gray-400">Se habilitan en la Task 9.</p>
      </section>
      <section id="tareas">
        <h2 className="mb-2 text-lg font-medium">Tareas</h2>
        <p className="text-sm text-gray-400">Se habilitan en la Task 11.</p>
      </section>
    </div>
  )
}
