import { boolean, pgTable, varchar } from 'drizzle-orm/pg-core'
import { idPk, timestamps } from '@/db/columns'

export const organizations = pgTable('organizations', {
  id: idPk(),
  name: varchar('name', { length: 200 }).notNull(),
  /** spec §12.5: when false, time entries skip the approval flow. Default off for the pilot. */
  requireTimeApproval: boolean('require_time_approval').default(false).notNull(),
  ...timestamps,
})
