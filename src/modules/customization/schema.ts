import { boolean, integer, jsonb, pgEnum, pgTable, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core'
import { idPk, timestamps } from '@/db/columns'
import { organizations } from '@/modules/organization/schema'

/** Fixed system category behind every custom status, so reports/kanban survive renames (spec §4.5). */
export const statusCategory = pgEnum('status_category', ['open', 'in_progress', 'blocked', 'done', 'cancelled'])

/** The 8 supported custom field types (def-§5.4). */
export const customFieldType = pgEnum('custom_field_type', [
  'text', 'number', 'date', 'select', 'multi_select', 'checkbox', 'user', 'link',
])

export const customStatuses = pgTable('custom_statuses', {
  id: idPk(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  /** 'project' | 'project_health' | 'milestone' | 'task' — subprojects reuse 'project'. */
  entityType: varchar('entity_type', { length: 30 }).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  /** null only for 'project_health' (indicator, not workflow). */
  category: statusCategory('category'),
  color: varchar('color', { length: 7 }),
  sortOrder: integer('sort_order').default(0).notNull(),
  isDefault: boolean('is_default').default(false).notNull(),
  ...timestamps,
})

export const customFields = pgTable('custom_fields', {
  id: idPk(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  entityType: varchar('entity_type', { length: 30 }).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  fieldType: customFieldType('field_type').notNull(),
  /** For select/multi_select: { options: string[] }. */
  options: jsonb('options'),
  sortOrder: integer('sort_order').default(0).notNull(),
  ...timestamps,
})

export const customFieldValues = pgTable(
  'custom_field_values',
  {
    id: idPk(),
    organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
    customFieldId: uuid('custom_field_id').references(() => customFields.id).notNull(),
    entityType: varchar('entity_type', { length: 30 }).notNull(),
    entityId: uuid('entity_id').notNull(),
    value: jsonb('value'),
    ...timestamps,
  },
  (t) => [uniqueIndex('cfv_field_entity_unique').on(t.customFieldId, t.entityId)],
)
