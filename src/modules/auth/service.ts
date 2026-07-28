import { and, eq, isNull } from 'drizzle-orm'
import type { Db } from '@/db'
import { users } from './schema'
import { verifyPassword } from './password'

/**
 * Valid bcrypt hash (cost 12) of a throwaway string. Compared against when the
 * email does not exist, so unknown and known emails take the same time and the
 * login endpoint cannot be used to enumerate users.
 */
const DUMMY_HASH = '$2b$12$4t0l/uhkJspSxiQI6AcpNuzI3YW6Pj5WL3beFJRjEo5rSXbRbIxRe'

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
  if (!user) {
    await verifyPassword(password, DUMMY_HASH)
    return null
  }
  const valid = await verifyPassword(password, user.passwordHash)
  if (!valid || !user.isActive) return null
  return { id: user.id, name: user.name, email: user.email, role: user.role, organizationId: user.organizationId }
}
