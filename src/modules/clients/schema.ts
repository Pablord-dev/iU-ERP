import { boolean, numeric, pgTable, text, uuid, varchar } from 'drizzle-orm/pg-core'
import { idPk, softDelete, timestamps } from '@/db/columns'
import { organizations } from '@/modules/organization/schema'

export const clients = pgTable('clients', {
  id: idPk(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  commercialName: varchar('commercial_name', { length: 200 }).notNull(),
  legalName: varchar('legal_name', { length: 200 }),
  contactName: varchar('contact_name', { length: 200 }),
  email: varchar('email', { length: 320 }),
  phone: varchar('phone', { length: 30 }),
  isActive: boolean('is_active').default(true).notNull(),
  /** Default hourly rate; projects may override it (spec §12.4). */
  hourlyRate: numeric('hourly_rate', { precision: 10, scale: 2 }),
  notes: text('notes'),
  ...timestamps,
  ...softDelete,
})
