import { and, desc, eq, isNull } from 'drizzle-orm'
import type { Db } from '@/db'
import type { Ctx } from '@/lib/ctx'
import { DomainError } from '@/lib/errors'
import { logActivity } from '@/modules/collaboration/service'
import { clients } from './schema'
import type { ClientInput } from './validation'

export type Client = typeof clients.$inferSelect

const scope = (ctx: Ctx, id?: string) =>
  and(eq(clients.organizationId, ctx.orgId), isNull(clients.deletedAt), ...(id ? [eq(clients.id, id)] : []))

/** numeric columns are strings in drizzle; normalize the form's number once here. */
const toRow = (input: ClientInput) => ({
  commercialName: input.commercialName,
  legalName: input.legalName ?? null,
  contactName: input.contactName ?? null,
  email: input.email ?? null,
  phone: input.phone ?? null,
  hourlyRate: input.hourlyRate != null ? String(input.hourlyRate) : null,
  notes: input.notes ?? null,
  isActive: input.isActive,
})

export async function listClients(db: Db, ctx: Ctx): Promise<Client[]> {
  return db.select().from(clients).where(scope(ctx)).orderBy(desc(clients.isActive), clients.commercialName)
}

export async function getClient(db: Db, ctx: Ctx, id: string): Promise<Client | null> {
  const [client] = await db.select().from(clients).where(scope(ctx, id))
  return client ?? null
}

export async function createClient(db: Db, ctx: Ctx, input: ClientInput): Promise<Client> {
  const [client] = await db.insert(clients).values({ organizationId: ctx.orgId, ...toRow(input) }).returning()
  await logActivity(db, ctx, { entityType: 'client', entityId: client.id, action: 'created' })
  return client
}

export async function updateClient(db: Db, ctx: Ctx, id: string, input: ClientInput): Promise<Client> {
  const before = await getClient(db, ctx, id)
  if (!before) throw new DomainError('Cliente no encontrado')
  const [client] = await db
    .update(clients)
    .set({ ...toRow(input), updatedAt: new Date() })
    .where(scope(ctx, id))
    .returning()
  await logActivity(db, ctx, {
    entityType: 'client',
    entityId: id,
    action: 'updated',
    changes: { before: { commercialName: before.commercialName }, after: { commercialName: client.commercialName } },
  })
  return client
}

export async function archiveClient(db: Db, ctx: Ctx, id: string): Promise<void> {
  const before = await getClient(db, ctx, id)
  if (!before) throw new DomainError('Cliente no encontrado')
  await db.update(clients).set({ deletedAt: new Date(), updatedAt: new Date() }).where(scope(ctx, id))
  await logActivity(db, ctx, { entityType: 'client', entityId: id, action: 'archived' })
}
