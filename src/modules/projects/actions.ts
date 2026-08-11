'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '@/db'
import { requireCtx } from '@/lib/session'
import { DomainError } from '@/lib/errors'
import type { ActionResult } from '@/lib/action-result'
import { fieldErrorsOf } from '@/lib/zod-utils'
import { projectInputSchema } from './validation'
import { archiveProject, createProject, updateProject } from './service'

/** memberIds llega de un <select multiple>: Object.fromEntries sólo conservaría el último. */
const parseForm = (formData: FormData) =>
  projectInputSchema.safeParse({
    ...Object.fromEntries(formData),
    memberIds: formData.getAll('memberIds'),
  })

export async function createProjectAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ctx = await requireCtx()
  const parsed = parseForm(formData)
  if (!parsed.success) return { ok: false, error: 'Revisa los campos marcados', fieldErrors: fieldErrorsOf(parsed.error) }
  let id: string
  try {
    id = (await createProject(db, ctx, parsed.data)).id
  } catch (e) {
    if (e instanceof DomainError) return { ok: false, error: e.message }
    throw e
  }
  revalidatePath('/proyectos')
  redirect(`/proyectos/${id}`)
}

export async function updateProjectAction(id: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ctx = await requireCtx()
  const parsed = parseForm(formData)
  if (!parsed.success) return { ok: false, error: 'Revisa los campos marcados', fieldErrors: fieldErrorsOf(parsed.error) }
  try {
    await updateProject(db, ctx, id, parsed.data)
  } catch (e) {
    if (e instanceof DomainError) return { ok: false, error: e.message }
    throw e
  }
  revalidatePath('/proyectos')
  revalidatePath(`/proyectos/${id}`)
  redirect(`/proyectos/${id}`)
}

export async function archiveProjectAction(id: string): Promise<void> {
  const ctx = await requireCtx()
  await archiveProject(db, ctx, id)
  revalidatePath('/proyectos')
  redirect('/proyectos')
}
