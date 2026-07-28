import { beforeAll, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import type { Db } from '@/db'
import { createTestDb } from '@/test/db'
import { organizations } from '@/modules/organization/schema'
import { users } from '@/modules/auth/schema'

describe('organizations and users schema', () => {
  let db: Db

  beforeAll(async () => {
    db = await createTestDb()
  })

  it('creates an organization with approval disabled by default', async () => {
    const [org] = await db.insert(organizations).values({ name: 'Test Org' }).returning()
    expect(org.requireTimeApproval).toBe(false)
    expect(org.id).toBeTruthy()
  })

  it('creates a user scoped to an organization', async () => {
    const [org] = await db.insert(organizations).values({ name: 'Org A' }).returning()
    const [user] = await db
      .insert(users)
      .values({
        organizationId: org.id,
        name: 'Ana',
        email: 'ana@example.com',
        passwordHash: 'x',
        role: 'admin',
      })
      .returning()
    expect(user.role).toBe('admin')
    const found = await db.select().from(users).where(eq(users.email, 'ana@example.com'))
    expect(found).toHaveLength(1)
  })

  it('rejects duplicate emails', async () => {
    const [org] = await db.insert(organizations).values({ name: 'Org B' }).returning()
    const base = { organizationId: org.id, name: 'Bo', passwordHash: 'x' } as const
    await db.insert(users).values({ ...base, email: 'dup@example.com' })
    await expect(db.insert(users).values({ ...base, email: 'dup@example.com' })).rejects.toThrow()
  })

  it('allows reusing the email of a soft-deleted user', async () => {
    const [org] = await db.insert(organizations).values({ name: 'Org C' }).returning()
    const base = { organizationId: org.id, name: 'Re', passwordHash: 'x' } as const
    await db.insert(users).values({ ...base, email: 'reuse@example.com', deletedAt: new Date() })
    const [again] = await db.insert(users).values({ ...base, email: 'reuse@example.com' }).returning()
    expect(again.deletedAt).toBeNull()
  })
})
