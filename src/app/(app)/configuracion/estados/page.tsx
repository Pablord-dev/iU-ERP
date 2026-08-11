import { db } from '@/db'
import { requireCtx } from '@/lib/session'
import { listStatuses } from '@/modules/customization/service'
import { StatusManager } from '@/modules/customization/status-manager'

const SECTIONS = [
  { entityType: 'project', title: 'Proyectos y subproyectos', allowCategory: true },
  { entityType: 'project_health', title: 'Salud del proyecto', allowCategory: false },
  { entityType: 'milestone', title: 'Hitos', allowCategory: true },
  { entityType: 'task', title: 'Tareas', allowCategory: true },
] as const

export default async function StatusesSettingsPage() {
  const ctx = await requireCtx()
  const sections = await Promise.all(
    SECTIONS.map(async (s) => ({ ...s, statuses: await listStatuses(db, ctx, s.entityType) })),
  )
  return (
    <div className="max-w-3xl space-y-8">
      <h1 className="text-2xl font-semibold">Configuración — Estados</h1>
      <p className="text-sm text-gray-500">
        Renombra, reordena o agrega estados. La categoría del sistema no cambia al renombrar: reportes y Kanban siguen funcionando.
      </p>
      {sections.map((s) => (
        <section key={s.entityType}>
          <h2 className="mb-2 text-lg font-medium">{s.title}</h2>
          <StatusManager entityType={s.entityType} statuses={s.statuses} allowCategory={s.allowCategory} />
        </section>
      ))}
    </div>
  )
}
