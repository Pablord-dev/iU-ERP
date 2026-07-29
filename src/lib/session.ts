import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import type { Ctx } from '@/lib/ctx'

export type SessionCtx = Ctx & { role: 'admin' | 'member'; name: string | null }

/** Session gate for Server Actions and RSC pages. */
export async function requireCtx(): Promise<SessionCtx> {
  const session = await auth()
  if (!session) redirect('/login')
  return {
    orgId: session.user.organizationId,
    userId: session.user.id,
    role: session.user.role,
    name: session.user.name ?? null,
  }
}
