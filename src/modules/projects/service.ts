import { and, eq, inArray, isNull } from 'drizzle-orm'
import type { Db } from '@/db'
import type { Ctx } from '@/lib/ctx'
import { DomainError } from '@/lib/errors'
import { isUuid } from '@/lib/uuid'
import { logActivity } from '@/modules/collaboration/service'
import { getClient } from '@/modules/clients/service'
import { clients } from '@/modules/clients/schema'
import { users } from '@/modules/auth/schema'
import { customStatuses } from '@/modules/customization/schema'
import { getDefaultStatus } from '@/modules/customization/service'
import type { CustomStatus } from '@/modules/customization/service'
import { projectMembers, projects } from './schema'
import type { ProjectInput } from './validation'

export type Project = typeof projects.$inferSelect
export interface ProjectListItem {
  project: Project
  clientName: string
  status: CustomStatus
}
export interface ProjectDetail extends ProjectListItem {
  health: CustomStatus | null
  responsibleName: string
  members: { id: string; name: string }[]
}

const scope = (ctx: Ctx, id?: string) =>
  and(eq(projects.organizationId, ctx.orgId), isNull(projects.deletedAt), ...(id ? [eq(projects.id, id)] : []))

/**
 * Cross-tenant guards: every FK the form sends must belong to ctx.orgId (spec §4.1).
 * `currentClientId` is the project's stored client — already org-scoped — and is accepted
 * even once archived, so archiving a client does not lock its projects out of editing.
 */
async function assertReferences(db: Db, ctx: Ctx, input: ProjectInput, currentClientId?: string): Promise<void> {
  if (input.clientId !== currentClientId && !(await getClient(db, ctx, input.clientId)))
    throw new DomainError('Cliente no encontrado')
  const people = [...new Set([input.responsibleId, ...input.memberIds])]
  // Soft-deleted users are gone for assignment purposes; merely deactivated ones still
  // pass, so editing an old project does not break when someone is put on hold.
  const found = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.organizationId, ctx.orgId), isNull(users.deletedAt), inArray(users.id, people)))
  if (found.length !== people.length) throw new DomainError('Usuario no encontrado')
  for (const [id, entityType] of [
    [input.statusId, 'project'],
    [input.healthId, 'project_health'],
  ] as const) {
    if (!id) continue
    const [status] = await db
      .select()
      .from(customStatuses)
      .where(
        and(
          eq(customStatuses.organizationId, ctx.orgId),
          eq(customStatuses.id, id),
          eq(customStatuses.entityType, entityType),
        ),
      )
    if (!status) throw new DomainError('Estado no válido')
  }
}

/** numeric columns are strings in drizzle; normalize the form's numbers once here. */
const toRow = (input: ProjectInput) => ({
  clientId: input.clientId,
  name: input.name,
  description: input.description ?? null,
  responsibleId: input.responsibleId,
  healthId: input.healthId ?? null,
  priority: input.priority,
  startDate: input.startDate ?? null,
  dueDate: input.dueDate ?? null,
  budgetedHours: input.budgetedHours != null ? String(input.budgetedHours) : null,
  hourlyRate: input.hourlyRate != null ? String(input.hourlyRate) : null,
})

async function replaceMembers(db: Db, projectId: string, memberIds: string[]): Promise<void> {
  // Deduplicado también aquí: el service no puede confiar en que su llamador ya validó.
  const unique = [...new Set(memberIds)]
  await db.delete(projectMembers).where(eq(projectMembers.projectId, projectId))
  if (unique.length) await db.insert(projectMembers).values(unique.map((userId) => ({ projectId, userId })))
}

export async function createProject(db: Db, ctx: Ctx, input: ProjectInput): Promise<Project> {
  // Row, members and audit entry are one unit: a half-written project with no team
  // would be indistinguishable from one deliberately left empty. The reference checks
  // share the transaction so they see the same snapshot the insert writes against.
  return db.transaction(async (tx) => {
    await assertReferences(tx, ctx, input)
    const statusId = input.statusId ?? (await getDefaultStatus(tx, ctx, 'project')).id
    const [project] = await tx
      .insert(projects)
      .values({ organizationId: ctx.orgId, statusId, ...toRow(input) })
      .returning()
    await replaceMembers(tx, project.id, input.memberIds)
    await logActivity(tx, ctx, { entityType: 'project', entityId: project.id, action: 'created' })
    return project
  })
}

export async function getProject(db: Db, ctx: Ctx, id: string): Promise<Project | null> {
  if (!isUuid(id)) return null
  const [project] = await db.select().from(projects).where(scope(ctx, id))
  return project ?? null
}

export async function listProjects(db: Db, ctx: Ctx, filter?: { clientId?: string }): Promise<ProjectListItem[]> {
  // Un filtro imposible no puede degradarse en "sin filtro": la vista de un cliente
  // acabaría mostrando los proyectos de todos los demás.
  if (filter?.clientId && !isUuid(filter.clientId)) return []
  return db
    .select({ project: projects, clientName: clients.commercialName, status: customStatuses })
    .from(projects)
    .innerJoin(clients, eq(projects.clientId, clients.id))
    .innerJoin(customStatuses, eq(projects.statusId, customStatuses.id))
    .where(and(scope(ctx), ...(filter?.clientId ? [eq(projects.clientId, filter.clientId)] : [])))
    .orderBy(projects.name)
}

export async function getProjectDetail(db: Db, ctx: Ctx, id: string): Promise<ProjectDetail | null> {
  const project = await getProject(db, ctx, id)
  if (!project) return null
  // Las FK ya están acotadas por assertReferences, pero la regla del proyecto es que
  // ninguna consulta salga sin organization_id: aquí es donde un bug futuro se
  // convertiría en una lectura cross-tenant.
  const [client] = await db
    .select()
    .from(clients)
    .where(and(eq(clients.organizationId, ctx.orgId), eq(clients.id, project.clientId)))
  const statusOfOrg = (id: string) =>
    db.select().from(customStatuses).where(and(eq(customStatuses.organizationId, ctx.orgId), eq(customStatuses.id, id)))
  const [status] = await statusOfOrg(project.statusId)
  const health = project.healthId ? ((await statusOfOrg(project.healthId))[0] ?? null) : null
  const [responsible] = await db
    .select()
    .from(users)
    .where(and(eq(users.organizationId, ctx.orgId), eq(users.id, project.responsibleId)))
  const members = await db
    .select({ id: users.id, name: users.name })
    .from(projectMembers)
    .innerJoin(users, and(eq(projectMembers.userId, users.id), eq(users.organizationId, ctx.orgId)))
    .where(eq(projectMembers.projectId, project.id))
    .orderBy(users.name)
  return { project, clientName: client.commercialName, status, health, responsibleName: responsible.name, members }
}

export async function updateProject(db: Db, ctx: Ctx, id: string, input: ProjectInput): Promise<Project> {
  // El estado previo se lee dentro de la transacción: leerlo fuera deja una ventana en la
  // que otro archiva el proyecto y esto registra en la bitácora una escritura que no ocurrió.
  return db.transaction(async (tx) => {
    const before = await getProjectDetail(tx, ctx, id)
    if (!before) throw new DomainError('Proyecto no encontrado')
    await assertReferences(tx, ctx, input, before.project.clientId)
    const statusId = input.statusId ?? before.project.statusId
    const [project] = await tx
      .update(projects)
      .set({ statusId, ...toRow(input), updatedAt: new Date() })
      .where(scope(ctx, id))
      .returning()
    if (!project) throw new DomainError('Proyecto no encontrado')
    await replaceMembers(tx, id, input.memberIds)
    if (statusId !== before.project.statusId) {
      const [after] = await tx.select().from(customStatuses).where(eq(customStatuses.id, statusId))
      await logActivity(tx, ctx, {
        entityType: 'project',
        entityId: id,
        action: 'status_changed',
        changes: { before: { status: before.status.name }, after: { status: after.name } },
      })
    } else {
      await logActivity(tx, ctx, {
        entityType: 'project',
        entityId: id,
        action: 'updated',
        changes: { before: { name: before.project.name }, after: { name: project.name } },
      })
    }
    return project
  })
}

export async function archiveProject(db: Db, ctx: Ctx, id: string): Promise<void> {
  if (!isUuid(id)) throw new DomainError('Proyecto no encontrado')
  await db.transaction(async (tx) => {
    // Sin fila actualizada no hubo archivado: dos clics simultáneos escribirían dos
    // entradas 'archived' y borrarían el equipo de un proyecto que no cambió.
    const [archived] = await tx
      .update(projects)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(scope(ctx, id))
      .returning()
    if (!archived) throw new DomainError('Proyecto no encontrado')
    await tx.delete(projectMembers).where(eq(projectMembers.projectId, id))
    await logActivity(tx, ctx, { entityType: 'project', entityId: id, action: 'archived' })
  })
}
