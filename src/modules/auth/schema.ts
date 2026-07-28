import { sql } from 'drizzle-orm'
import { boolean, pgEnum, pgTable, text, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core'
import { idPk, softDelete, timestamps } from '@/db/columns'
import { organizations } from '@/modules/organization/schema'

export const userRole = pgEnum('user_role', ['admin', 'member'])

export const users = pgTable(
  'users',
  {
    id: idPk(),
    organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
    name: varchar('name', { length: 200 }).notNull(),
    email: varchar('email', { length: 320 }).notNull(),
    passwordHash: text('password_hash').notNull(),
    role: userRole('role').default('member').notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    ...timestamps,
    ...softDelete,
  },
  // Partial unique: soft-deleted rows keep their email without blocking reuse (spec §4.8).
  (t) => [uniqueIndex('users_email_active_unique').on(t.email).where(sql`${t.deletedAt} is null`)],
)
