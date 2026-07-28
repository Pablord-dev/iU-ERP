import { date, integer, numeric, pgEnum, pgTable, primaryKey, text, uuid, varchar } from 'drizzle-orm/pg-core'
import { idPk, softDelete, timestamps } from '@/db/columns'
import { organizations } from '@/modules/organization/schema'
import { users } from '@/modules/auth/schema'
import { clients } from '@/modules/clients/schema'
import { customStatuses } from '@/modules/customization/schema'

export const priority = pgEnum('priority', ['low', 'medium', 'high', 'urgent'])

export const projects = pgTable('projects', {
  id: idPk(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  clientId: uuid('client_id').references(() => clients.id).notNull(),
  name: varchar('name', { length: 200 }).notNull(),
  description: text('description'),
  responsibleId: uuid('responsible_id').references(() => users.id).notNull(),
  statusId: uuid('status_id').references(() => customStatuses.id).notNull(),
  /** Optional health indicator; rows with entityType 'project_health'. */
  healthId: uuid('health_id').references(() => customStatuses.id),
  priority: priority('priority').default('medium').notNull(),
  startDate: date('start_date'),
  dueDate: date('due_date'),
  /** Manually captured budget (spec §12.3); consolidated estimates are always computed in queries. */
  budgetedHours: numeric('budgeted_hours', { precision: 8, scale: 2 }),
  /** Overrides clients.hourlyRate when set (spec §12.4). */
  hourlyRate: numeric('hourly_rate', { precision: 10, scale: 2 }),
  ...timestamps,
  ...softDelete,
})

export const projectMembers = pgTable(
  'project_members',
  {
    projectId: uuid('project_id').references(() => projects.id).notNull(),
    userId: uuid('user_id').references(() => users.id).notNull(),
  },
  (t) => [primaryKey({ columns: [t.projectId, t.userId] })],
)

/** Optional level (spec §4.2): small projects hang milestones directly. Reuses the 'project' status catalog. */
export const subprojects = pgTable('subprojects', {
  id: idPk(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  projectId: uuid('project_id').references(() => projects.id).notNull(),
  name: varchar('name', { length: 200 }).notNull(),
  description: text('description'),
  responsibleId: uuid('responsible_id').references(() => users.id),
  statusId: uuid('status_id').references(() => customStatuses.id).notNull(),
  startDate: date('start_date'),
  dueDate: date('due_date'),
  ...timestamps,
  ...softDelete,
})

export const milestones = pgTable('milestones', {
  id: idPk(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  projectId: uuid('project_id').references(() => projects.id).notNull(),
  subprojectId: uuid('subproject_id').references(() => subprojects.id),
  name: varchar('name', { length: 200 }).notNull(),
  description: text('description'),
  responsibleId: uuid('responsible_id').references(() => users.id),
  statusId: uuid('status_id').references(() => customStatuses.id).notNull(),
  targetDate: date('target_date'),
  sortOrder: integer('sort_order').default(0).notNull(),
  ...timestamps,
  ...softDelete,
})
