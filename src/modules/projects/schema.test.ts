import { beforeAll, describe, expect, it } from 'vitest'
import type { Db } from '@/db'
import { createTestDb } from '@/test/db'
import { organizations } from '@/modules/organization/schema'
import { users } from '@/modules/auth/schema'
import { customStatuses } from '@/modules/customization/schema'
import { clients } from '@/modules/clients/schema'
import { milestones, projects, subprojects } from '@/modules/projects/schema'

describe('hierarchy schema (def-§4.1)', () => {
  let db: Db
  let ids: { orgId: string; userId: string; clientId: string; projectStatusId: string; milestoneStatusId: string }

  beforeAll(async () => {
    db = await createTestDb()
    const [org] = await db.insert(organizations).values({ name: 'Org' }).returning()
    const [user] = await db
      .insert(users)
      .values({ organizationId: org.id, name: 'Ana', email: 'a@x.com', passwordHash: 'x' })
      .returning()
    const [pStatus] = await db
      .insert(customStatuses)
      .values({ organizationId: org.id, entityType: 'project', name: 'Activo', category: 'in_progress' })
      .returning()
    const [mStatus] = await db
      .insert(customStatuses)
      .values({ organizationId: org.id, entityType: 'milestone', name: 'Pendiente', category: 'open' })
      .returning()
    const [client] = await db
      .insert(clients)
      .values({ organizationId: org.id, commercialName: 'ACME', hourlyRate: '800.00' })
      .returning()
    ids = { orgId: org.id, userId: user.id, clientId: client.id, projectStatusId: pStatus.id, milestoneStatusId: mStatus.id }
  })

  it('creates a project with budget and rate override', async () => {
    const [project] = await db
      .insert(projects)
      .values({
        organizationId: ids.orgId,
        clientId: ids.clientId,
        name: 'Sitio web',
        responsibleId: ids.userId,
        statusId: ids.projectStatusId,
        budgetedHours: '120.00',
        hourlyRate: '950.00',
      })
      .returning()
    expect(project.priority).toBe('medium')
    expect(project.budgetedHours).toBe('120.00')
  })

  it('allows milestones directly under a project (no subproject)', async () => {
    const [project] = await db
      .insert(projects)
      .values({ organizationId: ids.orgId, clientId: ids.clientId, name: 'P2', responsibleId: ids.userId, statusId: ids.projectStatusId })
      .returning()
    const [milestone] = await db
      .insert(milestones)
      .values({ organizationId: ids.orgId, projectId: project.id, name: 'Entrega 1', statusId: ids.milestoneStatusId })
      .returning()
    expect(milestone.subprojectId).toBeNull()
  })

  it('links milestones to an optional subproject', async () => {
    const [project] = await db
      .insert(projects)
      .values({ organizationId: ids.orgId, clientId: ids.clientId, name: 'P3', responsibleId: ids.userId, statusId: ids.projectStatusId })
      .returning()
    const [sub] = await db
      .insert(subprojects)
      .values({ organizationId: ids.orgId, projectId: project.id, name: 'Backend', statusId: ids.projectStatusId })
      .returning()
    const [milestone] = await db
      .insert(milestones)
      .values({ organizationId: ids.orgId, projectId: project.id, subprojectId: sub.id, name: 'API lista', statusId: ids.milestoneStatusId })
      .returning()
    expect(milestone.subprojectId).toBe(sub.id)
  })
})
