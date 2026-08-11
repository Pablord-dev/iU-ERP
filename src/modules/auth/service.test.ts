import { beforeAll, describe, expect, it } from 'vitest'
import type { Db } from '@/db'
import { createTestDb } from '@/test/db'
import { organizations } from '@/modules/organization/schema'
import { users } from '@/modules/auth/schema'
import { hashPassword } from './password'
import { getSessionUser, listActiveUsers, verifyCredentials } from './service'

describe('verifyCredentials', () => {
  let db: Db

  beforeAll(async () => {
    db = await createTestDb()
    const [org] = await db.insert(organizations).values({ name: 'Org' }).returning()
    await db.insert(users).values([
      { organizationId: org.id, name: 'Ana', email: 'ana@x.com', passwordHash: await hashPassword('correct'), role: 'admin' },
      { organizationId: org.id, name: 'Out', email: 'out@x.com', passwordHash: await hashPassword('correct'), isActive: false },
    ])
  })

  it('returns the user for valid credentials', async () => {
    const user = await verifyCredentials(db, 'ana@x.com', 'correct')
    expect(user).toMatchObject({ email: 'ana@x.com', role: 'admin' })
    expect(user).not.toHaveProperty('passwordHash')
  })

  it('returns null for a wrong password', async () => {
    expect(await verifyCredentials(db, 'ana@x.com', 'nope')).toBeNull()
  })

  it('returns null for an unknown email', async () => {
    expect(await verifyCredentials(db, 'ghost@x.com', 'correct')).toBeNull()
  })

  it('returns null for an inactive user', async () => {
    expect(await verifyCredentials(db, 'out@x.com', 'correct')).toBeNull()
  })
})

describe('getSessionUser (live-session revalidation)', () => {
  let db: Db
  let activeId: string
  let inactiveId: string
  let deletedId: string

  beforeAll(async () => {
    db = await createTestDb()
    const [org] = await db.insert(organizations).values({ name: 'Org' }).returning()
    const rows = await db
      .insert(users)
      .values([
        { organizationId: org.id, name: 'Viva', email: 'viva@x.com', passwordHash: 'x', role: 'member' },
        { organizationId: org.id, name: 'Baja', email: 'baja@x.com', passwordHash: 'x', isActive: false },
        { organizationId: org.id, name: 'Borrada', email: 'borrada@x.com', passwordHash: 'x', deletedAt: new Date() },
      ])
      .returning()
    activeId = rows[0].id
    inactiveId = rows[1].id
    deletedId = rows[2].id
  })

  it('returns fresh data for an active user', async () => {
    const user = await getSessionUser(db, activeId)
    expect(user).toMatchObject({ id: activeId, email: 'viva@x.com', role: 'member' })
    expect(user).not.toHaveProperty('passwordHash')
  })

  it('returns null once the user is deactivated', async () => {
    expect(await getSessionUser(db, inactiveId)).toBeNull()
  })

  it('returns null once the user is soft-deleted', async () => {
    expect(await getSessionUser(db, deletedId)).toBeNull()
  })

  it('returns null for an unknown id', async () => {
    expect(await getSessionUser(db, crypto.randomUUID())).toBeNull()
  })
})

describe('listActiveUsers', () => {
  let db: Db
  let orgId: string

  beforeAll(async () => {
    db = await createTestDb()
    const [org] = await db.insert(organizations).values({ name: 'Org' }).returning()
    const [otherOrg] = await db.insert(organizations).values({ name: 'Otra' }).returning()
    orgId = org.id
    await db.insert(users).values([
      { organizationId: org.id, name: 'Zoe', email: 'zoe@x.com', passwordHash: 'x' },
      { organizationId: org.id, name: 'Ana', email: 'ana@x.com', passwordHash: 'x' },
      { organizationId: org.id, name: 'Baja', email: 'baja@x.com', passwordHash: 'x', isActive: false },
      { organizationId: org.id, name: 'Borrada', email: 'borrada@x.com', passwordHash: 'x', deletedAt: new Date() },
      { organizationId: otherOrg.id, name: 'Ajena', email: 'ajena@x.com', passwordHash: 'x' },
    ])
  })

  it('returns only live, active users of the organization, sorted by name', async () => {
    expect((await listActiveUsers(db, orgId)).map((u) => u.name)).toEqual(['Ana', 'Zoe'])
  })

  it('never leaks the password hash', async () => {
    expect(Object.keys((await listActiveUsers(db, orgId))[0])).toEqual(['id', 'name', 'email'])
  })
})
