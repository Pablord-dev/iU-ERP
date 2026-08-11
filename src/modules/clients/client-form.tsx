'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { ActionResult } from '@/lib/action-result'
import type { Client } from './service'

type FormAction = (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>

export function Field({ name, label, errors, children }: { name: string; label: string; errors?: string[]; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={name}>{label}</Label>
      {children}
      {errors?.map((e) => (
        <p key={e} className="text-sm text-red-600">{e}</p>
      ))}
    </div>
  )
}

export function ClientForm({ action, client }: { action: FormAction; client?: Client }) {
  const [state, formAction, pending] = useActionState(action, null)
  const errs = state && !state.ok ? (state.fieldErrors ?? {}) : {}
  return (
    <form action={formAction} className="max-w-xl space-y-4">
      {state && !state.ok && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{state.error}</p>}
      <Field name="commercialName" label="Nombre comercial *" errors={errs.commercialName}>
        <Input id="commercialName" name="commercialName" defaultValue={client?.commercialName} required />
      </Field>
      <Field name="legalName" label="Razón social" errors={errs.legalName}>
        <Input id="legalName" name="legalName" defaultValue={client?.legalName ?? ''} />
      </Field>
      <Field name="contactName" label="Contacto" errors={errs.contactName}>
        <Input id="contactName" name="contactName" defaultValue={client?.contactName ?? ''} />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field name="email" label="Correo" errors={errs.email}>
          <Input id="email" name="email" type="email" defaultValue={client?.email ?? ''} />
        </Field>
        <Field name="phone" label="Teléfono" errors={errs.phone}>
          <Input id="phone" name="phone" defaultValue={client?.phone ?? ''} />
        </Field>
      </div>
      <Field name="hourlyRate" label="Tarifa por hora (MXN)" errors={errs.hourlyRate}>
        <Input id="hourlyRate" name="hourlyRate" type="number" step="0.01" min="0" defaultValue={client?.hourlyRate ?? ''} />
      </Field>
      <Field name="notes" label="Notas" errors={errs.notes}>
        <Textarea id="notes" name="notes" defaultValue={client?.notes ?? ''} rows={4} />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isActive" defaultChecked={client?.isActive ?? true} />
        Cliente activo
      </label>
      <Button type="submit" disabled={pending}>{pending ? 'Guardando…' : 'Guardar'}</Button>
    </form>
  )
}
