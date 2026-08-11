'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '@/db'
import { requireCtx } from '@/lib/session'
import { DomainError } from '@/lib/errors'
import type { ActionResult } from '@/lib/action-result'
import { fieldErrorsOf } from '@/lib/zod-utils'
import { clientInputSchema } from './validation'
import { archiveClient, createClient, updateClient } from './service'

export async function createClientAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ctx = await requireCtx()
  const parsed = clientInputSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { ok: false, error: 'Revisa los campos marcados', fieldErrors: fieldErrorsOf(parsed.error) }
  try {
    await createClient(db, ctx, parsed.data)
  } catch (e) {
    if (e instanceof DomainError) return { ok: false, error: e.message }
    throw e
  }
  revalidatePath('/clientes')
  redirect('/clientes')
}

export async function updateClientAction(id: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ctx = await requireCtx()
  const parsed = clientInputSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { ok: false, error: 'Revisa los campos marcados', fieldErrors: fieldErrorsOf(parsed.error) }
  try {
    await updateClient(db, ctx, id, parsed.data)
  } catch (e) {
    if (e instanceof DomainError) return { ok: false, error: e.message }
    throw e
  }
  revalidatePath('/clientes')
  redirect(`/clientes/${id}`)
}

export async function archiveClientAction(id: string): Promise<void> {
  const ctx = await requireCtx()
  await archiveClient(db, ctx, id)
  revalidatePath('/clientes')
  redirect('/clientes')
}
