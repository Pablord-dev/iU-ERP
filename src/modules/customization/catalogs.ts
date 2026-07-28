export type StatusEntityType = 'project' | 'project_health' | 'milestone' | 'task'
export type StatusCategory = 'open' | 'in_progress' | 'blocked' | 'done' | 'cancelled'

export interface StatusCatalogEntry {
  entityType: StatusEntityType
  name: string
  category: StatusCategory | null
  sortOrder: number
  isDefault: boolean
}

const entry = (
  entityType: StatusEntityType,
  name: string,
  category: StatusCategory | null,
  sortOrder: number,
  isDefault = false,
): StatusCatalogEntry => ({ entityType, name, category, sortOrder, isDefault })

/** Initial status catalogs from def-§5.2, seeded as editable rows (spec §12.1). */
export const STATUS_CATALOGS: StatusCatalogEntry[] = [
  entry('project', 'Borrador', 'open', 0, true),
  entry('project', 'Planeación', 'open', 1),
  entry('project', 'Activo', 'in_progress', 2),
  entry('project', 'En pausa', 'blocked', 3),
  entry('project', 'En riesgo', 'in_progress', 4),
  entry('project', 'Completado', 'done', 5),
  entry('project', 'Cancelado', 'cancelled', 6),

  entry('project_health', 'En tiempo', null, 0, true),
  entry('project_health', 'Requiere atención', null, 1),
  entry('project_health', 'En riesgo', null, 2),
  entry('project_health', 'Retrasado', null, 3),

  entry('milestone', 'Pendiente', 'open', 0, true),
  entry('milestone', 'En progreso', 'in_progress', 1),
  entry('milestone', 'Bloqueado', 'blocked', 2),
  entry('milestone', 'En revisión', 'in_progress', 3),
  entry('milestone', 'Completado', 'done', 4),
  entry('milestone', 'Cancelado', 'cancelled', 5),

  entry('task', 'Pendiente', 'open', 0, true),
  entry('task', 'En progreso', 'in_progress', 1),
  entry('task', 'En revisión', 'in_progress', 2),
  entry('task', 'Bloqueada', 'blocked', 3),
  entry('task', 'Completada', 'done', 4),
  entry('task', 'Cancelada', 'cancelled', 5),
]
