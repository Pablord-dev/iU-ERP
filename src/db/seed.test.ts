import { beforeAll, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import type { Db } from '@/db'
import { createTestDb } from '@/test/db'
import { seed } from './seed'
import { organizations } from '@/modules/organization/schema'
import { users } from '@/modules/auth/schema'
import { customStatuses } from '@/modules/customization/schema'
import { STATUS_CATALOGS } from '@/modules/customization/catalogs'

const OPTS = { orgName: 'iU Corp', adminEmail: 'admin@test.com', adminPassword: 'secret123', adminName: 'Admin' }

describe('seed', () => {
  let db: Db

  beforeAll(async () => {
    db = await createTestDb()
  })

  it('creates org, admin and full status catalogs', async () => {
    await seed(db, OPTS)
    expect(await db.select().from(organizations)).toHaveLength(1)
    const admins = await db.select().from(users).where(eq(users.email, 'admin@test.com'))
    expect(admins).toHaveLength(1)
    expect(admins[0].role).toBe('admin')
    expect(admins[0].passwordHash).not.toBe('secret123') // stored hashed
    expect(await db.select().from(customStatuses)).toHaveLength(STATUS_CATALOGS.length)
  })

  it('is idempotent: running twice changes nothing', async () => {
    await seed(db, OPTS)
    expect(await db.select().from(organizations)).toHaveLength(1)
    expect(await db.select().from(users)).toHaveLength(1)
    expect(await db.select().from(customStatuses)).toHaveLength(STATUS_CATALOGS.length)
  })
})
