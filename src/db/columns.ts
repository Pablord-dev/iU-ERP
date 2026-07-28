import { timestamp, uuid } from 'drizzle-orm/pg-core'

/** UUID primary key with DB-side default. */
export const idPk = () => uuid('id').defaultRandom().primaryKey()

/** Standard audit timestamps for every business table. */
export const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}

/** Soft delete marker (spec §4.8): business entities are never hard-deleted. */
export const softDelete = {
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}
