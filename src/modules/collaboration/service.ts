import type { Db } from '@/db'
import type { Ctx } from '@/lib/ctx'
import { activityLog } from './schema'

export interface ActivityInput {
  entityType: string
  entityId: string
  action: string
  changes?: { before?: unknown; after?: unknown }
}

/** Single write-path to the audit trail (spec §7): every business mutation calls this. */
export async function logActivity(db: Db, ctx: Ctx, input: ActivityInput): Promise<void> {
  await db.insert(activityLog).values({
    organizationId: ctx.orgId,
    actorId: ctx.userId,
    entityType: input.entityType,
    entityId: input.entityId,
    action: input.action,
    changes: input.changes ?? null,
  })
}
