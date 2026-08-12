import { beforeAll, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import type { Db } from '@/db'
import { createTestDb } from '@/test/db'
import { seed } from '@/db/seed'
import { DomainError } from '@/lib/errors'
import type { Ctx } from '@/lib/ctx'
import { organizations } from '@/modules/organization/schema'
import { users } from '@/modules/auth/schema'
import { clients } from '@/modules/clients/schema'
import { activityLog } from '@/modules/collaboration/schema'
import { listStatuses } from '@/modules/customization/service'
import { projectMembers } from './schema'
import { archiveProject, createProject, getProject, getProjectDetail, listProjects, updateProject } from './service'

describe('projects service', () => {
  let db: Db
  let ctx: Ctx
  let clientId: string
  let userId: string

  beforeAll(async () => {
    db = await createTestDb()
    await seed(db, { orgName: 'Org', adminEmail: 'adm@x.com', adminPassword: 'x', adminName: 'Admin' })
    const [org] = await db.select().from(organizations)
    const [user] = await db.select().from(users)
    userId = user.id
    ctx = { orgId: org.id, userId }
    const [client] = await db.insert(clients).values({ organizationId: org.id, commercialName: 'ACME' }).returning()
    clientId = client.id
  })

  const base = () => ({ clientId, name: 'Sitio', responsibleId: userId, priority: 'medium' as const, memberIds: [] })

  it('creates a project with the default status and logs it', async () => {
    const project = await createProject(db, ctx, base())
    const detail = await getProjectDetail(db, ctx, project.id)
    expect(detail?.status.name).toBe('Borrador')
    expect(detail?.clientName).toBe('ACME')
    expect(detail?.responsibleName).toBe('Admin')
    const logs = await db.select().from(activityLog).where(eq(activityLog.entityId, project.id))
    expect(logs.map((l) => l.action)).toContain('created')
  })

  it('stores members and returns them in the detail', async () => {
    const project = await createProject(db, ctx, { ...base(), name: 'Con equipo', memberIds: [userId] })
    const detail = await getProjectDetail(db, ctx, project.id)
    expect(detail?.members.map((m) => m.id)).toEqual([userId])
  })

  it('replaces the member list on update instead of appending', async () => {
    const [extra] = await db
      .insert(users)
      .values({ organizationId: ctx.orgId, name: 'Zoe', email: 'zoe@x.com', passwordHash: 'x' })
      .returning()
    const project = await createProject(db, ctx, { ...base(), name: 'Rota equipo', memberIds: [userId] })
    await updateProject(db, ctx, project.id, { ...base(), name: 'Rota equipo', memberIds: [extra.id] })
    const detail = await getProjectDetail(db, ctx, project.id)
    expect(detail?.members.map((m) => m.id)).toEqual([extra.id])
  })

  it('rejects a client from another organization', async () => {
    const [orgB] = await db.insert(organizations).values({ name: 'B' }).returning()
    const [foreign] = await db.insert(clients).values({ organizationId: orgB.id, commercialName: 'Ajena' }).returning()
    await expect(createProject(db, ctx, { ...base(), clientId: foreign.id })).rejects.toThrow(DomainError)
  })

  it('rejects people and statuses that do not belong to the organization', async () => {
    const [orgC] = await db.insert(organizations).values({ name: 'C' }).returning()
    const [outsider] = await db
      .insert(users)
      .values({ organizationId: orgC.id, name: 'Ajeno', email: 'out@x.com', passwordHash: 'x' })
      .returning()
    await expect(createProject(db, ctx, { ...base(), responsibleId: outsider.id })).rejects.toThrow(DomainError)
    await expect(createProject(db, ctx, { ...base(), memberIds: [outsider.id] })).rejects.toThrow(DomainError)

    // Un estado real, pero de otro catálogo: no puede colarse como estado de proyecto.
    const taskStatus = (await listStatuses(db, ctx, 'task'))[0]
    await expect(createProject(db, ctx, { ...base(), statusId: taskStatus.id })).rejects.toThrow(DomainError)
    await expect(createProject(db, ctx, { ...base(), healthId: taskStatus.id })).rejects.toThrow(DomainError)
  })

  it('refuses to assign a soft-deleted user', async () => {
    const [gone] = await db
      .insert(users)
      .values({ organizationId: ctx.orgId, name: 'Ida', email: 'ida@x.com', passwordHash: 'x', deletedAt: new Date() })
      .returning()
    await expect(createProject(db, ctx, { ...base(), responsibleId: gone.id })).rejects.toThrow(DomainError)
  })

  it('keeps projects of an archived client editable', async () => {
    const [doomed] = await db.insert(clients).values({ organizationId: ctx.orgId, commercialName: 'Se archiva' }).returning()
    const project = await createProject(db, ctx, { ...base(), clientId: doomed.id, name: 'Del archivado' })
    await db.update(clients).set({ deletedAt: new Date() }).where(eq(clients.id, doomed.id))

    // Ya no admite proyectos nuevos...
    await expect(createProject(db, ctx, { ...base(), clientId: doomed.id, name: 'Otro' })).rejects.toThrow(DomainError)
    // ...pero archivar un cliente no puede dejar sus proyectos existentes sin poder guardarse.
    const renamed = await updateProject(db, ctx, project.id, { ...base(), clientId: doomed.id, name: 'Renombrado' })
    expect(renamed.name).toBe('Renombrado')
    // Y tampoco se puede mover el proyecto hacia otro cliente archivado.
    const [alsoGone] = await db
      .insert(clients)
      .values({ organizationId: ctx.orgId, commercialName: 'Otro archivado', deletedAt: new Date() })
      .returning()
    await expect(
      updateProject(db, ctx, project.id, { ...base(), clientId: alsoGone.id, name: 'Renombrado' }),
    ).rejects.toThrow(DomainError)
  })

  it('logs status_changed with before/after names on update', async () => {
    const project = await createProject(db, ctx, { ...base(), name: 'Cambia estado' })
    const activo = (await listStatuses(db, ctx, 'project')).find((s) => s.name === 'Activo')!
    await updateProject(db, ctx, project.id, { ...base(), name: 'Cambia estado', statusId: activo.id })
    const logs = await db.select().from(activityLog).where(eq(activityLog.entityId, project.id))
    const change = logs.find((l) => l.action === 'status_changed')
    expect(change?.changes).toEqual({ before: { status: 'Borrador' }, after: { status: 'Activo' } })
  })

  it('archives and disappears from listings', async () => {
    const project = await createProject(db, ctx, { ...base(), name: 'Efímero', memberIds: [userId] })
    await archiveProject(db, ctx, project.id)
    expect((await listProjects(db, ctx)).map((p) => p.project.id)).not.toContain(project.id)
    expect(await getProject(db, ctx, project.id)).toBeNull()
    const memberships = await db.select().from(projectMembers).where(eq(projectMembers.projectId, project.id))
    expect(memberships).toHaveLength(0) // members cleaned on archive
    await expect(archiveProject(db, ctx, project.id)).rejects.toThrow(DomainError)
  })

  it('filters the listing by client', async () => {
    const [other] = await db.insert(clients).values({ organizationId: ctx.orgId, commercialName: 'Otro' }).returning()
    await createProject(db, ctx, { ...base(), clientId: other.id, name: 'Del otro cliente' })
    const filtered = await listProjects(db, ctx, { clientId: other.id })
    expect(filtered.map((p) => p.project.name)).toEqual(['Del otro cliente'])
    expect(filtered[0].clientName).toBe('Otro')
    // Un filtro imposible devuelve nada; jamás la lista completa, que en la vista
    // "proyectos del cliente X" mostraría proyectos ajenos como si fueran suyos.
    expect(await listProjects(db, ctx, { clientId: 'not-a-uuid' })).toEqual([])
  })

  it('ignores duplicate member ids instead of violating the join table key', async () => {
    const project = await createProject(db, ctx, { ...base(), name: 'Duplicados', memberIds: [userId, userId] })
    const detail = await getProjectDetail(db, ctx, project.id)
    expect(detail?.members.map((m) => m.id)).toEqual([userId])
  })

  it('logs updated with before/after names when the status does not change', async () => {
    const project = await createProject(db, ctx, { ...base(), name: 'Antes' })
    await updateProject(db, ctx, project.id, { ...base(), name: 'Después' })
    const logs = await db.select().from(activityLog).where(eq(activityLog.entityId, project.id))
    const updated = logs.find((l) => l.action === 'updated')
    expect(updated?.changes).toEqual({ before: { name: 'Antes' }, after: { name: 'Después' } })
  })

  it('never reads or writes projects from another organization', async () => {
    const [orgD] = await db.insert(organizations).values({ name: 'D' }).returning()
    const [userD] = await db
      .insert(users)
      .values({ organizationId: orgD.id, name: 'Dana', email: 'dana@x.com', passwordHash: 'x' })
      .returning()
    const otherCtx: Ctx = { orgId: orgD.id, userId: userD.id }
    const mine = await createProject(db, ctx, { ...base(), name: 'Solo mío' })

    expect(await getProject(db, otherCtx, mine.id)).toBeNull()
    expect(await getProjectDetail(db, otherCtx, mine.id)).toBeNull()
    expect(await listProjects(db, otherCtx)).toEqual([])
    await expect(updateProject(db, otherCtx, mine.id, { ...base(), name: 'Secuestrado' })).rejects.toThrow(DomainError)
    await expect(archiveProject(db, otherCtx, mine.id)).rejects.toThrow(DomainError)
    expect((await getProject(db, ctx, mine.id))?.name).toBe('Solo mío')
  })

  it('rejects malformed ids with a domain error instead of a driver error', async () => {
    expect(await getProject(db, ctx, 'not-a-uuid')).toBeNull()
    expect(await getProjectDetail(db, ctx, 'not-a-uuid')).toBeNull()
    await expect(updateProject(db, ctx, 'not-a-uuid', base())).rejects.toThrow(DomainError)
    await expect(archiveProject(db, ctx, 'not-a-uuid')).rejects.toThrow(DomainError)
  })
})
