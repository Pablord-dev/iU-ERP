import { drizzle } from 'drizzle-orm/postgres-js'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import postgres from 'postgres'
import * as schema from './schema'

/** Driver-agnostic DB type: services depend on this, so tests can pass a PGlite instance. */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>

// prepare: false is required by Supabase's transaction pooler.
const client = postgres(process.env.DATABASE_URL!, { prepare: false })
export const db: Db = drizzle(client, { schema })
