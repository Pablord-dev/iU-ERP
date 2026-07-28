import { boolean, date, numeric, pgTable, primaryKey, text, uuid, varchar } from 'drizzle-orm/pg-core'
import { idPk, softDelete, timestamps } from '@/db/columns'
import { organizations } from '@/modules/organization/schema'
import { users } from '@/modules/auth/schema'
import { customStatuses } from '@/modules/customization/schema'
import { milestones, priority, projects, subprojects } from '@/modules/projects/schema'

export const tasks = pgTable('tasks', {
  id: idPk(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  projectId: uuid('project_id').references(() => projects.id).notNull(),
  subprojectId: uuid('subproject_id').references(() => subprojects.id),
  milestoneId: uuid('milestone_id').references(() => milestones.id).notNull(),
  name: varchar('name', { length: 200 }).notNull(),
  description: text('description'),
  statusId: uuid('status_id').references(() => customStatuses.id).notNull(),
  priority: priority('priority').default('medium').notNull(),
  startDate: date('start_date'),
  dueDate: date('due_date'),
  estimatedHours: numeric('estimated_hours', { precision: 8, scale: 2 }),
  /** Pre-fills is_billable on new time entries for this task. */
  isBillableDefault: boolean('is_billable_default').default(true).notNull(),
  ...timestamps,
  ...softDelete,
})

export const taskAssignees = pgTable(
  'task_assignees',
  {
    taskId: uuid('task_id').references(() => tasks.id).notNull(),
    userId: uuid('user_id').references(() => users.id).notNull(),
  },
  (t) => [primaryKey({ columns: [t.taskId, t.userId] })],
)
