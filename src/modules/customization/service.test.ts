import { beforeAll, describe, expect, it } from 'vitest'
import type { Db } from '@/db'
import { createTestDb } from '@/test/db'
import { organizations } from '@/modules/organization/schema'
import { users } from '@/modules/auth/schema'
import { clients } from '@/modules/clients/schema'
import { projects } from '@/modules/projects/schema'
import type { Ctx } from '@/lib/ctx'
import { DomainError } from '@/lib/errors'
import { seed } from '@/db/seed'
import { createStatus, deleteStatus, getDefaultStatus, listStatuses, moveStatus, updateStatus } from './service'

describe('custom statuses service', () => {
  let db: Db
  let ctx: Ctx

  beforeAll(async () => {
    db = await createTestDb()
    await seed(db, { orgName: 'Org', adminEmail: 'a@x.com', adminPassword: 'x', adminName: 'Ana' })
    const [org] = await db.select().from(organizations)
    const [user] = await db.select().from(users)
    ctx = { orgId: org.id, userId: user.id }
  })

  it('lists the seeded task statuses in order', async () => {
    const statuses = await listStatuses(db, ctx, 'task')
    expect(statuses.map((s) => s.name)).toEqual(['Pendiente', 'En progreso', 'En revisión', 'Bloqueada', 'Completada', 'Cancelada'])
  })

  it('returns the default status per entity type', async () => {
    expect((await getDefaultStatus(db, ctx, 'project')).name).toBe('Borrador')
    expect((await getDefaultStatus(db, ctx, 'task')).name).toBe('Pendiente')
  })

  it('creates a status at the end and renames it without touching its category', async () => {
    const created = await createStatus(db, ctx, { entityType: 'task', name: 'QA', category: 'in_progress' })
    const all = await listStatuses(db, ctx, 'task')
    expect(all[all.length - 1].name).toBe('QA')
    const renamed = await updateStatus(db, ctx, created.id, { name: 'QA interno' })
    expect(renamed.name).toBe('QA interno')
    expect(renamed.category).toBe('in_progress')
  })

  it('requires a category except for project_health', async () => {
    await expect(createStatus(db, ctx, { entityType: 'task', name: 'Sin cat', category: null })).rejects.toThrow(DomainError)
    const health = await createStatus(db, ctx, { entityType: 'project_health', name: 'Crítico', category: null })
    expect(health.category).toBeNull()
  })

  it('rejects duplicate names within an entity type instead of hitting the unique index', async () => {
    await expect(createStatus(db, ctx, { entityType: 'task', name: 'Pendiente', category: 'open' })).rejects.toThrow(DomainError)
    await expect(createStatus(db, ctx, { entityType: 'task', name: 'pendiente', category: 'open' })).rejects.toThrow(DomainError)
    const bloqueada = (await listStatuses(db, ctx, 'task')).find((s) => s.name === 'Bloqueada')!
    await expect(updateStatus(db, ctx, bloqueada.id, { name: 'Completada' })).rejects.toThrow(DomainError)
    // el mismo nombre en otro tipo de entidad sí es válido
    const milestoneDup = await createStatus(db, ctx, { entityType: 'milestone', name: 'Pendiente extra', category: 'open' })
    expect(milestoneDup.name).toBe('Pendiente extra')
    // renombrarse a sí mismo no choca consigo mismo
    expect((await updateStatus(db, ctx, bloqueada.id, { name: 'Bloqueada' })).name).toBe('Bloqueada')
  })

  it('refuses to delete the default status or one in use', async () => {
    const def = await getDefaultStatus(db, ctx, 'project')
    await expect(deleteStatus(db, ctx, def.id)).rejects.toThrow(DomainError)

    const active = (await listStatuses(db, ctx, 'project')).find((s) => s.name === 'Activo')!
    const [client] = await db.insert(clients).values({ organizationId: ctx.orgId, commercialName: 'C' }).returning()
    await db.insert(projects).values({ organizationId: ctx.orgId, clientId: client.id, name: 'P', responsibleId: ctx.userId, statusId: active.id })
    await expect(deleteStatus(db, ctx, active.id)).rejects.toThrow(DomainError)

    const disposable = await createStatus(db, ctx, { entityType: 'project', name: 'Borrable', category: 'open' })
    await deleteStatus(db, ctx, disposable.id)
    expect((await listStatuses(db, ctx, 'project')).map((s) => s.name)).not.toContain('Borrable')
  })

  it('reorders statuses swapping with the neighbor', async () => {
    const before = await listStatuses(db, ctx, 'milestone')
    await moveStatus(db, ctx, before[1].id, 'up')
    const after = await listStatuses(db, ctx, 'milestone')
    expect(after[0].id).toBe(before[1].id)
    expect(after[1].id).toBe(before[0].id)
    await moveStatus(db, ctx, after[0].id, 'up') // ya es el primero: no-op sin error
    expect((await listStatuses(db, ctx, 'milestone'))[0].id).toBe(after[0].id)
  })
})
