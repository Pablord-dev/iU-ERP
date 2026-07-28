import { beforeAll, describe, expect, it } from 'vitest'
import type { Db } from '@/db'
import { createTestDb } from '@/test/db'
import { organizations } from '@/modules/organization/schema'
import { users } from '@/modules/auth/schema'
import { hashPassword } from './password'
import { verifyCredentials } from './service'

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
