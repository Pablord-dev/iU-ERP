import { notFound } from 'next/navigation'
import { db } from '@/db'
import { requireCtx } from '@/lib/session'
import { getProjectDetail } from '@/modules/projects/service'
import { listClients } from '@/modules/clients/service'
import { listActiveUsers } from '@/modules/auth/service'
import { listStatuses } from '@/modules/customization/service'
import { ProjectForm } from '@/modules/projects/project-form'
import { updateProjectAction } from '@/modules/projects/actions'

export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await requireCtx()
  const detail = await getProjectDetail(db, ctx, id)
  if (!detail) notFound()
  const [clients, activeUsers, statuses, healths] = await Promise.all([
    listClients(db, ctx),
    listActiveUsers(db, ctx.orgId),
    listStatuses(db, ctx, 'project'),
    listStatuses(db, ctx, 'project_health'),
  ])
  // Responsable y participantes pudieron desactivarse después de asignarlos: el service los
  // sigue admitiendo, así que el select debe conservarlos. Sin esto, guardar un cambio de
  // prioridad mandaría el responsable vacío y borraría del equipo a los participantes
  // desactivados, sin aviso y sin que nadie los tocara.
  const byId = new Map(activeUsers.map((u) => [u.id, { id: u.id, name: u.name }]))
  for (const m of detail.members) byId.set(m.id, m)
  byId.set(detail.project.responsibleId, { id: detail.project.responsibleId, name: detail.responsibleName })
  const users = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'))
  // Lo mismo con el cliente: si lo archivaron, sin esta opción el formulario quedaría sin selección.
  const clientOptions = clients.map((c) => ({ id: c.id, name: c.commercialName }))
  if (!clientOptions.some((c) => c.id === detail.project.clientId))
    clientOptions.unshift({ id: detail.project.clientId, name: `${detail.clientName} (archivado)` })
  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Editar proyecto</h1>
      <ProjectForm
        action={updateProjectAction.bind(null, id)}
        clients={clientOptions}
        users={users}
        statuses={statuses}
        healths={healths}
        project={detail.project}
        detail={detail}
      />
    </div>
  )
}
