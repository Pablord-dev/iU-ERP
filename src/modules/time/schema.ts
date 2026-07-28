import { boolean, date, numeric, pgEnum, pgTable, text, uuid } from 'drizzle-orm/pg-core'
import { idPk, softDelete, timestamps } from '@/db/columns'
import { organizations } from '@/modules/organization/schema'
import { users } from '@/modules/auth/schema'
import { clients } from '@/modules/clients/schema'
import { milestones, projects, subprojects } from '@/modules/projects/schema'
import { tasks } from '@/modules/tasks/schema'

/** System state machines (spec §4.4) — NOT customizable statuses. */
export const approvalStatus = pgEnum('approval_status', ['draft', 'submitted', 'approved', 'rejected'])
export const billingStatus = pgEnum('billing_status', ['non_billable', 'pending_billing', 'in_billing_cut', 'billed'])

export const timeEntries = pgTable('time_entries', {
  id: idPk(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  /** client/project denormalized for weekly reports (def-§7.6); always derived from the task on write. */
  clientId: uuid('client_id').references(() => clients.id).notNull(),
  projectId: uuid('project_id').references(() => projects.id).notNull(),
  subprojectId: uuid('subproject_id').references(() => subprojects.id),
  milestoneId: uuid('milestone_id').references(() => milestones.id),
  taskId: uuid('task_id').references(() => tasks.id).notNull(),
  date: date('date').notNull(),
  hours: numeric('hours', { precision: 5, scale: 2 }).notNull(),
  description: text('description'),
  isBillable: boolean('is_billable').default(false).notNull(),
  /** Rule (spec §12.5): billing_status may only leave 'non_billable' if approved or approval is disabled. Enforced in time/service.ts (iteración 2). */
  approvalStatus: approvalStatus('approval_status').default('draft').notNull(),
  billingStatus: billingStatus('billing_status').default('non_billable').notNull(),
  ...timestamps,
  ...softDelete,
})
