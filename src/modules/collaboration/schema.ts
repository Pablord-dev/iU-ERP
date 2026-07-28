import { bigint, jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { idPk, softDelete, timestamps } from '@/db/columns'
import { organizations } from '@/modules/organization/schema'
import { users } from '@/modules/auth/schema'
import type { AnyPgColumn } from 'drizzle-orm/pg-core'

export const comments = pgTable('comments', {
  id: idPk(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  authorId: uuid('author_id').references(() => users.id).notNull(),
  entityType: varchar('entity_type', { length: 30 }).notNull(),
  entityId: uuid('entity_id').notNull(),
  /** Reply threading (def-§8). */
  parentId: uuid('parent_id').references((): AnyPgColumn => comments.id),
  body: text('body').notNull(),
  ...timestamps,
  ...softDelete,
})

/** Doubles as audit trail (spec §7): who, what, when, before/after. Never deleted. */
export const activityLog = pgTable('activity_log', {
  id: idPk(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  actorId: uuid('actor_id').references(() => users.id).notNull(),
  entityType: varchar('entity_type', { length: 30 }).notNull(),
  entityId: uuid('entity_id').notNull(),
  action: varchar('action', { length: 60 }).notNull(),
  changes: jsonb('changes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const notifications = pgTable('notifications', {
  id: idPk(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  type: varchar('type', { length: 40 }).notNull(),
  entityType: varchar('entity_type', { length: 30 }).notNull(),
  entityId: uuid('entity_id').notNull(),
  message: text('message').notNull(),
  readAt: timestamp('read_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

/** Metadata only; binary lives in Supabase Storage under storagePath (spec §2). */
export const attachments = pgTable('attachments', {
  id: idPk(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  uploaderId: uuid('uploader_id').references(() => users.id).notNull(),
  entityType: varchar('entity_type', { length: 30 }).notNull(),
  entityId: uuid('entity_id').notNull(),
  fileName: varchar('file_name', { length: 300 }).notNull(),
  storagePath: text('storage_path').notNull(),
  mimeType: varchar('mime_type', { length: 100 }).notNull(),
  sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
  ...timestamps,
  ...softDelete,
})
