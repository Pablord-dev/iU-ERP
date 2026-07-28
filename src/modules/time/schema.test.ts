import { beforeAll, describe, expect, it } from 'vitest'
import type { Db } from '@/db'
import { createTestDb } from '@/test/db'
import { organizations } from '@/modules/organization/schema'
import { users } from '@/modules/auth/schema'
import { customStatuses } from '@/modules/customization/schema'
import { clients } from '@/modules/clients/schema'
import { milestones, projects } from '@/modules/projects/schema'
import { taskAssignees, tasks } from '@/modules/tasks/schema'
import { timeEntries } from '@/modules/time/schema'

describe('tasks and time entries schema', () => {
  let db: Db
  let ctx: { orgId: string; userA: string; userB: string; clientId: string; projectId: string; taskId: string }

  beforeAll(async () => {
    db = await createTestDb()
    const [org] = await db.insert(organizations).values({ name: 'Org' }).returning()
    const [ua] = await db.insert(users).values({ organizationId: org.id, name: 'A', email: 'a@x.com', passwordHash: 'x' }).returning()
    const [ub] = await db.insert(users).values({ organizationId: org.id, name: 'B', email: 'b@x.com', passwordHash: 'x' }).returning()
    const [ps] = await db.insert(customStatuses).values({ organizationId: org.id, entityType: 'project', name: 'Activo', category: 'in_progress' }).returning()
    const [ms] = await db.insert(customStatuses).values({ organizationId: org.id, entityType: 'milestone', name: 'Pendiente', category: 'open' }).returning()
    const [ts] = await db.insert(customStatuses).values({ organizationId: org.id, entityType: 'task', name: 'Pendiente', category: 'open' }).returning()
    const [client] = await db.insert(clients).values({ organizationId: org.id, commercialName: 'ACME' }).returning()
    const [project] = await db.insert(projects).values({ organizationId: org.id, clientId: client.id, name: 'P', responsibleId: ua.id, statusId: ps.id }).returning()
    const [milestone] = await db.insert(milestones).values({ organizationId: org.id, projectId: project.id, name: 'M', statusId: ms.id }).returning()
    const [task] = await db.insert(tasks).values({ organizationId: org.id, projectId: project.id, milestoneId: milestone.id, name: 'T', statusId: ts.id, estimatedHours: '8.00' }).returning()
    ctx = { orgId: org.id, userA: ua.id, userB: ub.id, clientId: client.id, projectId: project.id, taskId: task.id }
  })

  it('supports multiple assignees per task (def-§7.5)', async () => {
    await db.insert(taskAssignees).values([
      { taskId: ctx.taskId, userId: ctx.userA },
      { taskId: ctx.taskId, userId: ctx.userB },
    ])
    const rows = await db.select().from(taskAssignees)
    expect(rows).toHaveLength(2)
  })

  it('creates a time entry starting as draft and non-billable', async () => {
    const [entry] = await db
      .insert(timeEntries)
      .values({
        organizationId: ctx.orgId,
        userId: ctx.userA,
        clientId: ctx.clientId,
        projectId: ctx.projectId,
        taskId: ctx.taskId,
        date: '2026-07-27',
        hours: '2.50',
        isBillable: true,
      })
      .returning()
    expect(entry.approvalStatus).toBe('draft')
    expect(entry.billingStatus).toBe('non_billable')
    expect(entry.hours).toBe('2.50')
  })
})
