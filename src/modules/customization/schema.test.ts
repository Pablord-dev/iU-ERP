import { beforeAll, describe, expect, it } from 'vitest'
import type { Db } from '@/db'
import { createTestDb } from '@/test/db'
import { organizations } from '@/modules/organization/schema'
import { customStatuses } from '@/modules/customization/schema'

describe('custom_statuses constraints', () => {
  let db: Db
  let orgId: string

  beforeAll(async () => {
    db = await createTestDb()
    const [org] = await db.insert(organizations).values({ name: 'Org' }).returning()
    orgId = org.id
  })

  it('rejects a duplicate status name within the same org and entity type', async () => {
    await db
      .insert(customStatuses)
      .values({ organizationId: orgId, entityType: 'task', name: 'Pendiente', category: 'open' })
    await expect(
      db
        .insert(customStatuses)
        .values({ organizationId: orgId, entityType: 'task', name: 'Pendiente', category: 'open' }),
    ).rejects.toThrow()
  })

  it('allows the same name for a different entity type', async () => {
    const [row] = await db
      .insert(customStatuses)
      .values({ organizationId: orgId, entityType: 'milestone', name: 'Pendiente', category: 'open' })
      .returning()
    expect(row.id).toBeTruthy()
  })

  it('rejects a second default status for the same entity type', async () => {
    await db
      .insert(customStatuses)
      .values({ organizationId: orgId, entityType: 'project', name: 'Borrador', category: 'open', isDefault: true })
    await expect(
      db
        .insert(customStatuses)
        .values({ organizationId: orgId, entityType: 'project', name: 'Activo', category: 'in_progress', isDefault: true }),
    ).rejects.toThrow()
  })
})
