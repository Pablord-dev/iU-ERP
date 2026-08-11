import { and, asc, eq, or, sql } from 'drizzle-orm'
import type { Db } from '@/db'
import type { Ctx } from '@/lib/ctx'
import { DomainError } from '@/lib/errors'
import { isUuid } from '@/lib/uuid'
import { logActivity } from '@/modules/collaboration/service'
import { customStatuses } from './schema'
import type { StatusCategory, StatusEntityType } from './catalogs'
import { milestones, projects, subprojects } from '@/modules/projects/schema'
import { tasks } from '@/modules/tasks/schema'

export type CustomStatus = typeof customStatuses.$inferSelect

export interface StatusInput {
  entityType: StatusEntityType
  name: string
  category: StatusCategory | null
  color?: string
}

const byOrg = (ctx: Ctx) => eq(customStatuses.organizationId, ctx.orgId)

export async function listStatuses(db: Db, ctx: Ctx, entityType: StatusEntityType): Promise<CustomStatus[]> {
  return db
    .select()
    .from(customStatuses)
    .where(and(byOrg(ctx), eq(customStatuses.entityType, entityType)))
    .orderBy(asc(customStatuses.sortOrder), asc(customStatuses.createdAt))
}

export async function getDefaultStatus(db: Db, ctx: Ctx, entityType: StatusEntityType): Promise<CustomStatus> {
  const all = await listStatuses(db, ctx, entityType)
  const found = all.find((s) => s.isDefault) ?? all[0]
  if (!found) throw new DomainError('No hay estados configurados para esta entidad')
  return found
}

export async function createStatus(db: Db, ctx: Ctx, input: StatusInput): Promise<CustomStatus> {
  if (input.entityType !== 'project_health' && !input.category)
    throw new DomainError('La categoría es obligatoria para este tipo de entidad')
  const existing = await listStatuses(db, ctx, input.entityType)
  if (existing.some((s) => s.name.toLowerCase() === input.name.toLowerCase()))
    throw new DomainError('Ya existe un estado con ese nombre')
  const sortOrder = existing.length ? Math.max(...existing.map((s) => s.sortOrder)) + 1 : 0
  const [status] = await db
    .insert(customStatuses)
    .values({
      organizationId: ctx.orgId,
      entityType: input.entityType,
      name: input.name,
      category: input.entityType === 'project_health' ? null : input.category,
      color: input.color ?? null,
      sortOrder,
    })
    .returning()
  await logActivity(db, ctx, { entityType: 'custom_status', entityId: status.id, action: 'created' })
  return status
}

async function getOwnStatus(db: Db, ctx: Ctx, id: string): Promise<CustomStatus> {
  if (!isUuid(id)) throw new DomainError('Estado no encontrado')
  const [status] = await db.select().from(customStatuses).where(and(byOrg(ctx), eq(customStatuses.id, id)))
  if (!status) throw new DomainError('Estado no encontrado')
  return status
}

export async function updateStatus(db: Db, ctx: Ctx, id: string, input: { name: string; color?: string }): Promise<CustomStatus> {
  const before = await getOwnStatus(db, ctx, id)
  const siblings = await listStatuses(db, ctx, before.entityType as StatusEntityType)
  if (siblings.some((s) => s.id !== id && s.name.toLowerCase() === input.name.toLowerCase()))
    throw new DomainError('Ya existe un estado con ese nombre')
  const [status] = await db
    .update(customStatuses)
    // color is left untouched when omitted: callers that only rename must not clear it.
    .set({ name: input.name, ...(input.color !== undefined && { color: input.color }), updatedAt: new Date() })
    .where(and(byOrg(ctx), eq(customStatuses.id, id)))
    .returning()
  await logActivity(db, ctx, {
    entityType: 'custom_status',
    entityId: id,
    action: 'updated',
    changes: {
      before: { name: before.name, color: before.color },
      after: { name: status.name, color: status.color },
    },
  })
  return status
}

/** Archived rows count as usage: their FKs are ON DELETE NO ACTION, so the row still pins the status. */
async function statusInUse(db: Db, ctx: Ctx, id: string): Promise<boolean> {
  const count = sql<number>`count(*)::int`
  const [p] = await db
    .select({ n: count })
    .from(projects)
    .where(and(eq(projects.organizationId, ctx.orgId), or(eq(projects.statusId, id), eq(projects.healthId, id))))
  const [s] = await db
    .select({ n: count })
    .from(subprojects)
    .where(and(eq(subprojects.organizationId, ctx.orgId), eq(subprojects.statusId, id)))
  const [m] = await db
    .select({ n: count })
    .from(milestones)
    .where(and(eq(milestones.organizationId, ctx.orgId), eq(milestones.statusId, id)))
  const [t] = await db
    .select({ n: count })
    .from(tasks)
    .where(and(eq(tasks.organizationId, ctx.orgId), eq(tasks.statusId, id)))
  return p.n + s.n + m.n + t.n > 0
}

export async function deleteStatus(db: Db, ctx: Ctx, id: string): Promise<void> {
  const status = await getOwnStatus(db, ctx, id)
  if (status.isDefault) throw new DomainError('No se puede eliminar el estado por defecto')
  if (await statusInUse(db, ctx, id)) throw new DomainError('El estado está en uso y no se puede eliminar')
  await db.delete(customStatuses).where(and(byOrg(ctx), eq(customStatuses.id, id)))
  await logActivity(db, ctx, { entityType: 'custom_status', entityId: id, action: 'deleted' })
}

export async function moveStatus(db: Db, ctx: Ctx, id: string, direction: 'up' | 'down'): Promise<void> {
  const status = await getOwnStatus(db, ctx, id)
  const siblings = await listStatuses(db, ctx, status.entityType as StatusEntityType)
  const idx = siblings.findIndex((s) => s.id === id)
  const target = direction === 'up' ? idx - 1 : idx + 1
  if (target < 0 || target >= siblings.length) return
  const reordered = [...siblings]
  ;[reordered[idx], reordered[target]] = [reordered[target], reordered[idx]]
  // Renumber the whole list rather than swapping two values: tied sortOrders would otherwise
  // make the swap a silent no-op with no way to recover from the UI.
  await db.transaction(async (tx) => {
    for (const [position, sibling] of reordered.entries()) {
      if (sibling.sortOrder === position) continue
      await tx
        .update(customStatuses)
        .set({ sortOrder: position, updatedAt: new Date() })
        .where(and(byOrg(ctx), eq(customStatuses.id, sibling.id)))
    }
    await logActivity(tx, ctx, {
      entityType: 'custom_status',
      entityId: id,
      action: 'reordered',
      changes: { before: { position: idx }, after: { position: target } },
    })
  })
}
