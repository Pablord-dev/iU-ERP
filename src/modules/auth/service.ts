import { eq } from 'drizzle-orm'
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

/** Business rule: only active, non-deleted users may sign in. Never leaks the hash. */
export async function verifyCredentials(db: Db, email: string, password: string): Promise<AuthUser | null> {
  const [user] = await db.select().from(users).where(eq(users.email, email))
  if (!user || !user.isActive || user.deletedAt) return null
  const valid = await verifyPassword(password, user.passwordHash)
  if (!valid) return null
  return { id: user.id, name: user.name, email: user.email, role: user.role, organizationId: user.organizationId }
}
