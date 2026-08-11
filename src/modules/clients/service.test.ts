import { beforeAll, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import type { Db } from '@/db'
import { createTestDb } from '@/test/db'
import { organizations } from '@/modules/organization/schema'
import { users } from '@/modules/auth/schema'
import { activityLog } from '@/modules/collaboration/schema'
import { clients } from './schema'
import type { Ctx } from '@/lib/ctx'
import { DomainError } from '@/lib/errors'
import { archiveClient, createClient, getClient, listClients, updateClient } from './service'

const INPUT = { commercialName: 'ACME', isActive: true }

describe('clients service', () => {
  let db: Db
  let ctx: Ctx
  let otherCtx: Ctx

  beforeAll(async () => {
    db = await createTestDb()
    const [orgA] = await db.insert(organizations).values({ name: 'A' }).returning()
    const [orgB] = await db.insert(organizations).values({ name: 'B' }).returning()
    const [ua] = await db.insert(users).values({ organizationId: orgA.id, name: 'Ana', email: 'a@x.com', passwordHash: 'x' }).returning()
    const [ub] = await db.insert(users).values({ organizationId: orgB.id, name: 'Bea', email: 'b@x.com', passwordHash: 'x' }).returning()
    ctx = { orgId: orgA.id, userId: ua.id }
    otherCtx = { orgId: orgB.id, userId: ub.id }
  })

  it('creates a client and logs the activity', async () => {
    const client = await createClient(db, ctx, { ...INPUT, hourlyRate: 800 })
    expect(client.commercialName).toBe('ACME')
    expect(client.hourlyRate).toBe('800.00') // numeric(10,2) llega como string con escala
    const logs = await db.select().from(activityLog).where(eq(activityLog.entityId, client.id))
    expect(logs).toHaveLength(1)
    expect(logs[0].action).toBe('created')
  })

  it('never leaks clients across organizations', async () => {
    await createClient(db, otherCtx, { commercialName: 'Ajena', isActive: true })
    const names = (await listClients(db, ctx)).map((c) => c.commercialName)
    expect(names).toContain('ACME')
    expect(names).not.toContain('Ajena')
    const foreign = (await listClients(db, otherCtx)).find((c) => c.commercialName === 'Ajena')
    expect(await getClient(db, ctx, foreign!.id)).toBeNull()
  })

  it('updates a client and logs before/after', async () => {
    const client = await createClient(db, ctx, { commercialName: 'Viejo', isActive: true })
    const updated = await updateClient(db, ctx, client.id, { commercialName: 'Nuevo', isActive: true })
    expect(updated.commercialName).toBe('Nuevo')
    const logs = await db.select().from(activityLog).where(eq(activityLog.entityId, client.id))
    const upd = logs.find((l) => l.action === 'updated')
    expect(upd?.changes).toMatchObject({ before: { commercialName: 'Viejo' }, after: { commercialName: 'Nuevo' } })
  })

  it('rejects updating a client from another organization', async () => {
    const foreign = (await listClients(db, otherCtx))[0]
    await expect(updateClient(db, ctx, foreign.id, INPUT)).rejects.toThrow(DomainError)
  })

  it('archives instead of deleting and hides archived clients', async () => {
    const client = await createClient(db, ctx, { commercialName: 'Temporal', isActive: true })
    await archiveClient(db, ctx, client.id)
    expect(await getClient(db, ctx, client.id)).toBeNull()
    expect((await listClients(db, ctx)).map((c) => c.id)).not.toContain(client.id)
    const [raw] = await db.select().from(clients).where(eq(clients.id, client.id))
    expect(raw.deletedAt).not.toBeNull()
  })
})
