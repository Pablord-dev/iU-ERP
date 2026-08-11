'use client'

import { useActionState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import type { ActionResult } from '@/lib/action-result'
import type { CustomStatus } from './service'
import { createStatusAction, deleteStatusAction, moveStatusAction, updateStatusAction } from './actions'

const CATEGORY_LABELS: Record<string, string> = {
  open: 'Abierto', in_progress: 'En progreso', blocked: 'Bloqueado', done: 'Terminado', cancelled: 'Cancelado',
}

function StatusRow({ status, first, last }: { status: CustomStatus; first: boolean; last: boolean }) {
  const [state, formAction] = useActionState(updateStatusAction.bind(null, status.id), null)
  const [pending, startTransition] = useTransition()
  const act = (fn: () => Promise<ActionResult>) =>
    startTransition(async () => {
      const res = await fn()
      if (!res.ok) toast.error(res.error)
    })
  return (
    <li className="flex items-center gap-2 rounded border bg-white p-2">
      <span className="inline-block h-4 w-4 rounded-full border" style={{ backgroundColor: status.color ?? '#e5e7eb' }} />
      <form action={formAction} className="flex flex-1 items-center gap-2">
        <Input name="name" defaultValue={status.name} className="h-8 max-w-56" />
        <Input name="color" type="color" defaultValue={status.color ?? '#e5e7eb'} className="h-8 w-12 p-1" />
        <Button type="submit" size="sm" variant="outline">Guardar</Button>
        {state && !state.ok && <span className="text-sm text-red-600">{state.error}</span>}
      </form>
      {status.category && <Badge variant="secondary">{CATEGORY_LABELS[status.category]}</Badge>}
      {status.isDefault && <Badge>Default</Badge>}
      <Button size="sm" variant="ghost" disabled={first || pending} onClick={() => act(() => moveStatusAction(status.id, 'up'))}>↑</Button>
      <Button size="sm" variant="ghost" disabled={last || pending} onClick={() => act(() => moveStatusAction(status.id, 'down'))}>↓</Button>
      <Button size="sm" variant="ghost" className="text-red-600" disabled={status.isDefault || pending}
        onClick={() => act(() => deleteStatusAction(status.id))}>Eliminar</Button>
    </li>
  )
}

export function StatusManager({ entityType, statuses, allowCategory }: { entityType: string; statuses: CustomStatus[]; allowCategory: boolean }) {
  const [state, formAction, pending] = useActionState(createStatusAction, null)
  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {statuses.map((s, i) => (
          <StatusRow key={s.id} status={s} first={i === 0} last={i === statuses.length - 1} />
        ))}
      </ul>
      <form action={formAction} className="flex items-end gap-2 rounded border border-dashed p-3">
        <input type="hidden" name="entityType" value={entityType} />
        <div className="flex-1">
          <Input name="name" placeholder="Nombre del nuevo estado" required />
        </div>
        {allowCategory && (
          <select name="category" className="h-9 rounded border px-2 text-sm" required>
            <option value="">Categoría…</option>
            {Object.entries(CATEGORY_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        )}
        <Button type="submit" disabled={pending}>Agregar</Button>
        {state && !state.ok && <span className="text-sm text-red-600">{state.error}</span>}
      </form>
    </div>
  )
}
