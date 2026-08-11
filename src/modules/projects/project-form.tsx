'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Field } from '@/modules/clients/client-form'
import type { ActionResult } from '@/lib/action-result'
import type { CustomStatus } from '@/modules/customization/service'
import type { Project, ProjectDetail } from './service'

type Option = { id: string; name: string }
type FormAction = (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>

const PRIORITIES = [
  ['low', 'Baja'], ['medium', 'Media'], ['high', 'Alta'], ['urgent', 'Urgente'],
] as const

export function ProjectForm({ action, clients, users, statuses, healths, project, detail }: {
  action: FormAction
  clients: Option[]
  users: Option[]
  statuses: CustomStatus[]
  healths: CustomStatus[]
  project?: Project
  detail?: ProjectDetail
}) {
  const [state, formAction, pending] = useActionState(action, null)
  const errs = state && !state.ok ? (state.fieldErrors ?? {}) : {}
  const select = 'h-9 w-full rounded border px-2 text-sm'
  // Mismo criterio que getDefaultStatus en el service: el catálogo es editable, así que
  // el nombre del estado por defecto se lee, nunca se escribe en el código.
  const defaultStatus = statuses.find((s) => s.isDefault) ?? statuses[0]
  return (
    <form action={formAction} className="max-w-2xl space-y-4">
      {state && !state.ok && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{state.error}</p>}
      <div className="grid grid-cols-2 gap-4">
        <Field name="clientId" label="Cliente *" errors={errs.clientId}>
          <select id="clientId" name="clientId" defaultValue={project?.clientId ?? ''} required className={select}>
            <option value="">Selecciona…</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field name="responsibleId" label="Responsable *" errors={errs.responsibleId}>
          <select id="responsibleId" name="responsibleId" defaultValue={project?.responsibleId ?? ''} required className={select}>
            <option value="">Selecciona…</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </Field>
      </div>
      <Field name="name" label="Nombre *" errors={errs.name}>
        <Input id="name" name="name" defaultValue={project?.name} maxLength={200} required />
      </Field>
      <Field name="description" label="Descripción" errors={errs.description}>
        <Textarea id="description" name="description" defaultValue={project?.description ?? ''} rows={3} />
      </Field>
      <div className="grid grid-cols-3 gap-4">
        <Field name="statusId" label="Estado" errors={errs.statusId}>
          <select id="statusId" name="statusId" defaultValue={project?.statusId ?? ''} className={select}>
            {!project && <option value="">Predeterminado{defaultStatus ? ` (${defaultStatus.name})` : ''}</option>}
            {statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <Field name="healthId" label="Salud" errors={errs.healthId}>
          <select id="healthId" name="healthId" defaultValue={project?.healthId ?? ''} className={select}>
            <option value="">Sin indicador</option>
            {healths.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <Field name="priority" label="Prioridad" errors={errs.priority}>
          <select id="priority" name="priority" defaultValue={project?.priority ?? 'medium'} className={select}>
            {PRIORITIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field name="startDate" label="Fecha de inicio" errors={errs.startDate}>
          <Input id="startDate" name="startDate" type="date" defaultValue={project?.startDate ?? ''} />
        </Field>
        <Field name="dueDate" label="Fecha compromiso" errors={errs.dueDate}>
          <Input id="dueDate" name="dueDate" type="date" defaultValue={project?.dueDate ?? ''} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {/* min y max replican projectInputSchema: el navegador avisa antes de mandar el submit. */}
        <Field name="budgetedHours" label="Horas presupuestadas" errors={errs.budgetedHours}>
          <Input id="budgetedHours" name="budgetedHours" type="number" step="0.25" min="0.25" max="999999.99"
            defaultValue={project?.budgetedHours ?? ''} />
        </Field>
        <Field name="hourlyRate" label="Tarifa por hora (sobrescribe la del cliente)" errors={errs.hourlyRate}>
          <Input id="hourlyRate" name="hourlyRate" type="number" step="0.01" min="0.01" max="99999999.99"
            defaultValue={project?.hourlyRate ?? ''} />
        </Field>
      </div>
      <Field name="memberIds" label="Participantes (Ctrl/Cmd + clic para varios)" errors={errs.memberIds}>
        <select id="memberIds" name="memberIds" multiple size={Math.min(Math.max(users.length, 2), 5)}
          defaultValue={detail?.members.map((m) => m.id) ?? []} className="w-full rounded border p-2 text-sm">
          {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </Field>
      <Button type="submit" disabled={pending}>{pending ? 'Guardando…' : 'Guardar'}</Button>
    </form>
  )
}
