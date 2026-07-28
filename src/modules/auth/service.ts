import { and, eq, isNull } from 'drizzle-orm'
import type { Db } from '@/db'
import { users } from './schema'
import { verifyPassword } from './password'

export interface AuthUser {
  id: string
  name: string
  email: string
  role: 'admin' | 'member'
  organizationId: string
}

/**
 * Live-session revalidation: deactivating or soft-deleting a user must cut
 * their access immediately, not when the JWT expires. Called from the jwt
 * callback on every auth() so role/name changes propagate too.
 */
export async function getSessionUser(db: Db, userId: string): Promise<AuthUser | null> {
  const [user] = await db.select().from(users).where(eq(users.id, userId))
  if (!user || !user.isActive || user.deletedAt) return null
  return { id: user.id, name: user.name, email: user.email, role: user.role, organizationId: user.organizationId }
}

/** Business rule: only active, non-deleted users may sign in. Never leaks the hash. */
export async function verifyCredentials(db: Db, email: string, password: string): Promise<AuthUser | null> {
  // deleted_at filter in the query: with email reuse, the live row must win over soft-deleted ones.
  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.email, email), isNull(users.deletedAt)))
  if (!user || !user.isActive) return null
  const valid = await verifyPassword(password, user.passwordHash)
  if (!valid) return null
  return { id: user.id, name: user.name, email: user.email, role: user.role, organizationId: user.organizationId }
}
