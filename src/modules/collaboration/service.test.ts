import { beforeAll, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import type { Db } from '@/db'
import { createTestDb } from '@/test/db'
import { organizations } from '@/modules/organization/schema'
import { users } from '@/modules/auth/schema'
import { activityLog } from '@/modules/collaboration/schema'
import { logActivity } from './service'
import type { Ctx } from '@/lib/ctx'

describe('logActivity', () => {
  let db: Db
  let ctx: Ctx

  beforeAll(async () => {
    db = await createTestDb()
    const [org] = await db.insert(organizations).values({ name: 'Org' }).returning()
    const [user] = await db
      .insert(users)
      .values({ organizationId: org.id, name: 'Ana', email: 'a@x.com', passwordHash: 'x' })
      .returning()
    ctx = { orgId: org.id, userId: user.id }
  })

  it('records who, what and before/after', async () => {
    const entityId = crypto.randomUUID()
    await logActivity(db, ctx, {
      entityType: 'client',
      entityId,
      action: 'status_changed',
      changes: { before: { isActive: true }, after: { isActive: false } },
    })
    const [row] = await db.select().from(activityLog).where(eq(activityLog.entityId, entityId))
    expect(row.organizationId).toBe(ctx.orgId)
    expect(row.actorId).toBe(ctx.userId)
    expect(row.entityType).toBe('client')
    expect(row.action).toBe('status_changed')
    expect(row.changes).toEqual({ before: { isActive: true }, after: { isActive: false } })
  })

  it('stores null changes when none are given', async () => {
    const entityId = crypto.randomUUID()
    await logActivity(db, ctx, { entityType: 'task', entityId, action: 'created' })
    const [row] = await db.select().from(activityLog).where(eq(activityLog.entityId, entityId))
    expect(row.changes).toBeNull()
  })
})
