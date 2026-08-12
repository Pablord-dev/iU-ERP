import { db } from '@/db'
import { requireCtx } from '@/lib/session'
import { listClients } from '@/modules/clients/service'
import { listActiveUsers } from '@/modules/auth/service'
import { listStatuses } from '@/modules/customization/service'
import { ProjectForm } from '@/modules/projects/project-form'
import { createProjectAction } from '@/modules/projects/actions'

export default async function NewProjectPage() {
  const ctx = await requireCtx()
  const [clients, users, statuses, healths] = await Promise.all([
    listClients(db, ctx),
    listActiveUsers(db, ctx.orgId),
    listStatuses(db, ctx, 'project'),
    listStatuses(db, ctx, 'project_health'),
  ])
  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Nuevo proyecto</h1>
      <ProjectForm
        action={createProjectAction}
        clients={clients.map((c) => ({ id: c.id, name: c.commercialName }))}
        users={users}
        statuses={statuses}
        healths={healths}
      />
    </div>
  )
}
