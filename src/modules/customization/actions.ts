'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { requireCtx } from '@/lib/session'
import { DomainError } from '@/lib/errors'
import type { ActionResult } from '@/lib/action-result'
import { fieldErrorsOf } from '@/lib/zod-utils'
import { statusInputSchema, statusUpdateSchema } from './validation'
import { createStatus, deleteStatus, moveStatus, updateStatus } from './service'

const run = async (fn: () => Promise<unknown>): Promise<ActionResult> => {
  try {
    await fn()
  } catch (e) {
    if (e instanceof DomainError) return { ok: false, error: e.message }
    throw e
  }
  revalidatePath('/configuracion/estados')
  return { ok: true }
}

export async function createStatusAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ctx = await requireCtx()
  const parsed = statusInputSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { ok: false, error: 'Revisa los campos', fieldErrors: fieldErrorsOf(parsed.error) }
  return run(() => createStatus(db, ctx, { ...parsed.data, category: parsed.data.category ?? null }))
}

export async function updateStatusAction(id: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ctx = await requireCtx()
  const parsed = statusUpdateSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { ok: false, error: 'Revisa los campos', fieldErrors: fieldErrorsOf(parsed.error) }
  return run(() => updateStatus(db, ctx, id, parsed.data))
}

export async function deleteStatusAction(id: string): Promise<ActionResult> {
  const ctx = await requireCtx()
  return run(() => deleteStatus(db, ctx, id))
}

export async function moveStatusAction(id: string, direction: 'up' | 'down'): Promise<ActionResult> {
  const ctx = await requireCtx()
  return run(() => moveStatus(db, ctx, id, direction))
}
