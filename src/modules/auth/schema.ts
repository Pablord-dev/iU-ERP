import { boolean, pgEnum, pgTable, text, uuid, varchar } from 'drizzle-orm/pg-core'
import { idPk, softDelete, timestamps } from '@/db/columns'
import { organizations } from '@/modules/organization/schema'

export const userRole = pgEnum('user_role', ['admin', 'member'])

export const users = pgTable('users', {
  id: idPk(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  name: varchar('name', { length: 200 }).notNull(),
  email: varchar('email', { length: 320 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: userRole('role').default('member').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  ...timestamps,
  ...softDelete,
})
