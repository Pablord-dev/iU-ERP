import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import type { Db } from '@/db'
import * as schema from '@/db/schema'

/** In-memory Postgres with the real migrations applied. One instance per test file. */
export async function createTestDb(): Promise<Db> {
  const client = new PGlite()
  const db = drizzle(client, { schema }) as unknown as Db
  await migrate(db as never, { migrationsFolder: './drizzle' })
  return db
}
