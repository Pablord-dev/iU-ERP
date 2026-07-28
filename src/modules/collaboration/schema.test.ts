import { beforeAll, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import type { Db } from '@/db'
import { createTestDb } from '@/test/db'
import { organizations } from '@/modules/organization/schema'
import { users } from '@/modules/auth/schema'
import { activityLog, comments } from '@/modules/collaboration/schema'

describe('polymorphic collaboration schema (spec §4.7)', () => {
  let db: Db
  let orgId: string
  let userId: string

  beforeAll(async () => {
    db = await createTestDb()
    const [org] = await db.insert(organizations).values({ name: 'Org' }).returning()
    const [user] = await db.insert(users).values({ organizationId: org.id, name: 'A', email: 'a@x.com', passwordHash: 'x' }).returning()
    orgId = org.id
    userId = user.id
  })

  it('attaches comments to any entity type', async () => {
    const fakeProjectId = crypto.randomUUID()
    const fakeTaskId = crypto.randomUUID()
    await db.insert(comments).values([
      { organizationId: orgId, authorId: userId, entityType: 'project', entityId: fakeProjectId, body: 'Comentario en proyecto' },
      { organizationId: orgId, authorId: userId, entityType: 'task', entityId: fakeTaskId, body: 'Comentario en tarea' },
    ])
    const onProject = await db.select().from(comments).where(eq(comments.entityType, 'project'))
    expect(onProject).toHaveLength(1)
  })

  it('records before/after changes in the activity log', async () => {
    const [row] = await db
      .insert(activityLog)
      .values({
        organizationId: orgId,
        actorId: userId,
        entityType: 'task',
        entityId: crypto.randomUUID(),
        action: 'status_changed',
        changes: { before: { status: 'Pendiente' }, after: { status: 'En progreso' } },
      })
      .returning()
    expect(row.changes).toEqual({ before: { status: 'Pendiente' }, after: { status: 'En progreso' } })
  })
})
