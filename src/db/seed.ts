import { and, eq, isNull } from 'drizzle-orm'
import type { Db } from '@/db'
import { organizations } from '@/modules/organization/schema'
import { users } from '@/modules/auth/schema'
import { customStatuses } from '@/modules/customization/schema'
import { STATUS_CATALOGS } from '@/modules/customization/catalogs'
import { hashPassword } from '@/modules/auth/password'

export interface SeedOptions {
  orgName: string
  adminEmail: string
  adminPassword: string
  adminName: string
}

/** Idempotent bootstrap: single org, one admin, def-§5.2 status catalogs. Safe to re-run. */
export async function seed(db: Db, opts: SeedOptions): Promise<void> {
  let [org] = await db.select().from(organizations).where(eq(organizations.name, opts.orgName))
  if (!org) {
    ;[org] = await db.insert(organizations).values({ name: opts.orgName }).returning()
  }

  // Only a live admin counts: if the seeded admin was soft-deleted, recreate it.
  const existingAdmin = await db
    .select()
    .from(users)
    .where(and(eq(users.email, opts.adminEmail), isNull(users.deletedAt)))
  if (existingAdmin.length === 0) {
    await db.insert(users).values({
      organizationId: org.id,
      name: opts.adminName,
      email: opts.adminEmail,
      passwordHash: await hashPassword(opts.adminPassword),
      role: 'admin',
    })
  }

  for (const status of STATUS_CATALOGS) {
    const existing = await db
      .select()
      .from(customStatuses)
      .where(
        and(
          eq(customStatuses.organizationId, org.id),
          eq(customStatuses.entityType, status.entityType),
          eq(customStatuses.name, status.name),
        ),
      )
    if (existing.length === 0) {
      await db.insert(customStatuses).values({ organizationId: org.id, ...status })
    }
  }
}
