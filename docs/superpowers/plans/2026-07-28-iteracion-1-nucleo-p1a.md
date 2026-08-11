# Iteración 1 — Núcleo P1a: Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capturar toda la jerarquía operativa (cliente → proyecto → subproyecto → hito → tarea) con CRUD completo, multi-responsable, estados personalizados editables y campos personalizados básicos — criterios 1–6 y parte del 17 de def-§10.

**Architecture:** Cada módulo de dominio (`src/modules/*`) suma `validation.ts` (Zod compartido), `service.ts` (lógica pura sobre `Db` + `Ctx`, testeada con PGlite) y `actions.ts` (Server Actions que autentican, validan y llaman al service). La UI vive en `src/app/(app)/*` con shadcn/ui; toda mutación registra actividad en `activity_log` desde el service. Los estados de proyecto/subproyecto/hito/tarea salen de `custom_statuses` (nunca hardcodeados).

**Tech Stack:** Next.js 16 (App Router, Server Actions, `useActionState`), TypeScript estricto, shadcn/ui + Tailwind 4, Drizzle ORM, Zod v4, Vitest + PGlite, Playwright.

**Spec:** `docs/superpowers/specs/2026-07-28-p-erp-mvp1-tech-design.md` (referencias `§n`); `docs/mios/definicionMVP1.md` (referencias `def-§n`). El esquema de BD ya existe completo (Iteración 0) — esta iteración **no crea tablas nuevas**.

## Global Constraints

- TypeScript **estricto**; `npm run lint && npm run typecheck && npm test` en verde antes de **cada** commit.
- UI, mensajes de error y URLs en **español**; código, identificadores y commits en **inglés** (imperativo, ≤72 caracteres).
- **Ninguna consulta sin filtro `organization_id`** (spec §4.1). Todo service recibe `(db: Db, ctx: Ctx, ...)` — jamás importa el cliente concreto ni lee la sesión.
- **Soft delete** (`deleted_at`) para clientes, proyectos, subproyectos, hitos y tareas; nunca DELETE físico. Toda lectura excluye `deleted_at IS NOT NULL`.
- **Reglas de negocio en `service.ts`**, nunca en componentes React (spec §3). Las Server Actions solo autentican, validan (Zod) y delegan.
- **Toda mutación de negocio escribe en `activity_log`** vía `logActivity` (spec §5 flujo ②, §7 auditoría).
- Estados personalizables **siempre** desde `custom_statuses` filtrando por `entity_type`; los subproyectos reutilizan el catálogo `project` (Iteración 0). Las categorías del sistema (`open/in_progress/blocked/done/cancelled`) gobiernan la semántica (p. ej. "atrasada" = vencida y categoría ∉ {done, cancelled}).
- Totales/consolidaciones **se calculan en consultas**; jamás contadores almacenados (spec §1/§4.3).
- Flujo git (`docs/mios/instruccionesGit.md`): **una task = una rama = una sesión = un PR**. Cada task se trabaja en `feat/it1-task-NN-<slug>` creada desde `master` actualizado (la task anterior ya mergeada), y cierra con: checkboxes de la task marcados `[x]` en este plan (commiteado en la rama), `git diff` mostrado al usuario, code review, y PR con `gh pr create`. Commits pequeños por unidad lógica.
- Formularios: `<form action={...}>` + `useActionState`; resultado tipado `ActionResult`; en éxito la action hace `revalidatePath` + `redirect`.

---

### Task 1: shadcn/ui, helpers de dominio y shell de la app

**Files:**
- Create: `src/lib/ctx.ts`, `src/lib/errors.ts`, `src/lib/session.ts`, `src/lib/action-result.ts`, `src/lib/zod-utils.ts`
- Create: `src/app/(app)/layout.tsx`, `src/app/(app)/page.tsx`, `src/components/app-sidebar.tsx`
- Create (vía CLI shadcn): `components.json`, `src/components/ui/*`, `src/lib/utils.ts`
- Delete: `src/app/page.tsx` (se mueve a `(app)/page.tsx`)

**Interfaces:**
- Consumes: `auth`, `signOut` de `@/auth` (Iteración 0)
- Produces (todo lo que usan las Tasks 2–14):
  - `Ctx { orgId: string; userId: string }` en `@/lib/ctx`
  - `DomainError` (con `message` en español) en `@/lib/errors`
  - `requireCtx(): Promise<Ctx & { role: 'admin' | 'member' }>` en `@/lib/session` (redirige a `/login` sin sesión)
  - `ActionResult = { ok: true } | { ok: false; error: string; fieldErrors?: Record<string, string[]> }` en `@/lib/action-result`
  - `fieldErrorsOf(error: ZodError): Record<string, string[]>` y `emptyToUndefined` en `@/lib/zod-utils`
  - Componentes shadcn: `button, input, label, textarea, select, badge, card, table, dialog, separator, sonner`

- [x] **Step 1: Crear la rama**

```bash
git checkout master && git pull
git checkout -b feat/it1-task-01-shell
```

(En las tasks siguientes el nombre de la rama cambia: `feat/it1-task-02-activity-log`, `feat/it1-task-03-clients-service`, etc., siempre desde `master` con la task anterior ya mergeada.)

- [x] **Step 2: Instalar shadcn/ui y componentes base**

```bash
npx shadcn@latest init --yes -b neutral
npx shadcn@latest add --yes button input label textarea select badge card table dialog separator sonner
```

Si `init` pregunta algo pese a `--yes`, aceptar defaults (RSC, Tailwind 4, alias `@/*`). Verificar que creó `components.json` y `src/components/ui/`.

> **Nota de ejecución (Task 1):** la CLI de shadcn 4.16 eliminó el flag de color base; el init real fue `npx shadcn@latest init --yes -b radix -p nova` (baseColor `neutral` quedó registrado en `components.json`). Además renombró la variable de fuente sans: el layout raíz ahora usa `--font-sans` en lugar de `--font-geist-sans`. Por code review, `SessionCtx` incluye también `name: string | null` (el layout hace una sola llamada a `requireCtx` en vez de `auth()` extra) — cambio aditivo, el contrato `Ctx & { role }` se mantiene.

- [x] **Step 3: Crear los helpers de dominio**

`src/lib/ctx.ts`:

```ts
/** Tenant + actor scope threaded through every service call. */
export interface Ctx {
  orgId: string
  userId: string
}
```

`src/lib/errors.ts`:

```ts
/** Business-rule violation; `message` is user-facing Spanish (spec §7). */
export class DomainError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DomainError'
  }
}
```

`src/lib/session.ts`:

```ts
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import type { Ctx } from '@/lib/ctx'

export type SessionCtx = Ctx & { role: 'admin' | 'member' }

/** Session gate for Server Actions and RSC pages. */
export async function requireCtx(): Promise<SessionCtx> {
  const session = await auth()
  if (!session) redirect('/login')
  return {
    orgId: session.user.organizationId,
    userId: session.user.id,
    role: session.user.role,
  }
}
```

`src/lib/action-result.ts`:

```ts
export type ActionResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> }
```

`src/lib/zod-utils.ts`:

```ts
import type { ZodError } from 'zod'

/** Map issues to { field: [messages] } without depending on flatten() shape. */
export function fieldErrorsOf(error: ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_root'
    ;(out[key] ??= []).push(issue.message)
  }
  return out
}

/** For optional form fields: '' → undefined so Zod optionals work with FormData. */
export const emptyToUndefined = (v: unknown) =>
  typeof v === 'string' && v.trim() === '' ? undefined : v
```

- [x] **Step 4: Crear el shell con navegación**

`src/components/app-sidebar.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const links = [
  { href: '/', label: 'Inicio' },
  { href: '/clientes', label: 'Clientes' },
  { href: '/proyectos', label: 'Proyectos' },
  { href: '/tareas', label: 'Tareas' },
  { href: '/configuracion/estados', label: 'Configuración' },
]

export function AppSidebar() {
  const pathname = usePathname()
  return (
    <nav className="flex w-56 shrink-0 flex-col gap-1 border-r bg-white p-4">
      <p className="mb-4 text-lg font-semibold">P-ERP</p>
      {links.map((l) => {
        const active = l.href === '/' ? pathname === '/' : pathname.startsWith(l.href.split('/').slice(0, 2).join('/'))
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`rounded px-3 py-2 text-sm ${active ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'}`}
          >
            {l.label}
          </Link>
        )
      })}
    </nav>
  )
}
```

`src/app/(app)/layout.tsx`:

```tsx
import { Toaster } from '@/components/ui/sonner'
import { AppSidebar } from '@/components/app-sidebar'
import { requireCtx } from '@/lib/session'
import { auth, signOut } from '@/auth'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireCtx()
  const session = await auth()
  return (
    <div className="flex min-h-screen bg-gray-50">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-end gap-3 border-b bg-white px-6 py-3">
          <span className="text-sm text-gray-600">{session?.user.name}</span>
          <form
            action={async () => {
              'use server'
              await signOut({ redirectTo: '/login' })
            }}
          >
            <button type="submit" className="rounded border px-3 py-1 text-sm hover:bg-gray-100">
              Cerrar sesión
            </button>
          </form>
        </header>
        <main className="min-w-0 flex-1 p-6">{children}</main>
      </div>
      <Toaster />
    </div>
  )
}
```

`src/app/(app)/page.tsx` (reemplaza al viejo `src/app/page.tsx`, que se elimina):

```tsx
export default function HomePage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">Inicio</h1>
      <p className="mt-2 text-gray-500">
        El dashboard llega en la iteración 2. Usa el menú para capturar clientes, proyectos y tareas.
      </p>
    </div>
  )
}
```

```bash
rm src/app/page.tsx
```

- [x] **Step 5: Verificar**

Run: `npm run lint && npm run typecheck && npm test && npm run build`
Expected: todo en verde; el build lista `/`, `/clientes` aún no existe (llega en Task 4).
Luego `npm run dev`: `/` muestra el shell con sidebar y el nombre del usuario; "Cerrar sesión" funciona.

- [x] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add shadcn/ui, domain helpers and app shell"
```

---

### Task 2: Bitácora de actividad — `logActivity`

**Files:**
- Create: `src/modules/collaboration/service.ts`, `src/modules/collaboration/service.test.ts`

**Interfaces:**
- Consumes: `activityLog` (Iteración 0), `Ctx`, `createTestDb`
- Produces: `logActivity(db: Db, ctx: Ctx, input: { entityType: string; entityId: string; action: string; changes?: { before?: unknown; after?: unknown } }): Promise<void>` — la usan **todos** los services de mutación (Tasks 3, 5, 6, 8, 9, 10, 13)

- [x] **Step 1: Escribir el test que falla — `src/modules/collaboration/service.test.ts`**

```ts
import { beforeAll, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import type { Db } from '@/db'
import { createTestDb } from '@/test/db'
import { organizations } from '@/modules/organization/schema'
import { users } from '@/modules/auth/schema'
import { activityLog } from '@/modules/collaboration/schema'
import { logActivity } from './service'
import type { Ctx } from '@/lib/ctx'

describe('logActivity', () => {
  let db: Db
  let ctx: Ctx

  beforeAll(async () => {
    db = await createTestDb()
    const [org] = await db.insert(organizations).values({ name: 'Org' }).returning()
    const [user] = await db
      .insert(users)
      .values({ organizationId: org.id, name: 'Ana', email: 'a@x.com', passwordHash: 'x' })
      .returning()
    ctx = { orgId: org.id, userId: user.id }
  })

  it('records who, what and before/after', async () => {
    const entityId = crypto.randomUUID()
    await logActivity(db, ctx, {
      entityType: 'client',
      entityId,
      action: 'status_changed',
      changes: { before: { isActive: true }, after: { isActive: false } },
    })
    const [row] = await db.select().from(activityLog).where(eq(activityLog.entityId, entityId))
    expect(row.organizationId).toBe(ctx.orgId)
    expect(row.actorId).toBe(ctx.userId)
    expect(row.action).toBe('status_changed')
    expect(row.changes).toEqual({ before: { isActive: true }, after: { isActive: false } })
  })

  it('stores null changes when none are given', async () => {
    const entityId = crypto.randomUUID()
    await logActivity(db, ctx, { entityType: 'task', entityId, action: 'created' })
    const [row] = await db.select().from(activityLog).where(eq(activityLog.entityId, entityId))
    expect(row.changes).toBeNull()
  })
})
```

- [x] **Step 2: Correr y verificar que falla**

Run: `npm test`
Expected: FAIL — `./service` no existe en collaboration.

- [x] **Step 3: Implementar `src/modules/collaboration/service.ts`**

```ts
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
```

- [x] **Step 4: Correr los tests y verificar que pasan**

Run: `npm test`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add src/modules/collaboration/service.ts src/modules/collaboration/service.test.ts
git commit -m "feat: add activity logging service"
```

---

### Task 3: Clientes — validación y service

**Files:**
- Create: `src/modules/clients/validation.ts`, `src/modules/clients/service.ts`, `src/modules/clients/service.test.ts`

**Interfaces:**
- Consumes: `clients` schema, `Ctx`, `DomainError`, `logActivity`, `createTestDb`
- Produces (los usa Task 4):
  - `clientInputSchema` (Zod) y `ClientInput` en `@/modules/clients/validation`
  - En `@/modules/clients/service`, todos con filtro de org y excluyendo borrados:
    - `listClients(db: Db, ctx: Ctx): Promise<Client[]>` (orden: activos primero, luego nombre)
    - `getClient(db: Db, ctx: Ctx, id: string): Promise<Client | null>`
    - `createClient(db: Db, ctx: Ctx, input: ClientInput): Promise<Client>`
    - `updateClient(db: Db, ctx: Ctx, id: string, input: ClientInput): Promise<Client>` (lanza `DomainError` si no existe)
    - `archiveClient(db: Db, ctx: Ctx, id: string): Promise<void>` (soft delete)
  - `Client = typeof clients.$inferSelect`

- [x] **Step 1: Crear `src/modules/clients/validation.ts`**

```ts
import { z } from 'zod'
import { emptyToUndefined } from '@/lib/zod-utils'

const optionalText = (max: number) =>
  z.preprocess(emptyToUndefined, z.string().trim().max(max).optional())

export const clientInputSchema = z.object({
  commercialName: z.string().trim().min(1, 'El nombre comercial es obligatorio').max(200),
  legalName: optionalText(200),
  contactName: optionalText(200),
  email: z.preprocess(emptyToUndefined, z.string().email('Correo inválido').max(320).optional()),
  phone: optionalText(30),
  /** Default hourly rate (spec §12.4); form sends a string. */
  hourlyRate: z.preprocess(
    emptyToUndefined,
    z.coerce.number({ message: 'Debe ser un número' }).positive('Debe ser mayor a 0').optional(),
  ),
  notes: optionalText(5000),
  isActive: z.preprocess((v) => v === 'on' || v === true, z.boolean()),
})

export type ClientInput = z.infer<typeof clientInputSchema>
```

> **Nota de ejecución (Task 3):** el snippet original llevaba `.default(true)` en `isActive`, pero en Zod 4 `.default()` corta antes del preprocess: un checkbox desmarcado (clave ausente en FormData) parseaba como `true` y era imposible desactivar un cliente desde el formulario de la Task 4. Se eliminó el `.default` (el preprocess ya mapea `undefined → false`; el `defaultChecked` del form cubre el default de UI) y se agregó `src/modules/clients/validation.test.ts` con la semántica del checkbox, la coerción de `hourlyRate` y `emptyToUndefined`.

- [x] **Step 2: Escribir el test que falla — `src/modules/clients/service.test.ts`**

```ts
import { beforeAll, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import type { Db } from '@/db'
import { createTestDb } from '@/test/db'
import { organizations } from '@/modules/organization/schema'
import { users } from '@/modules/auth/schema'
import { activityLog } from '@/modules/collaboration/schema'
import { clients } from './schema'
import type { Ctx } from '@/lib/ctx'
import { DomainError } from '@/lib/errors'
import { archiveClient, createClient, getClient, listClients, updateClient } from './service'

const INPUT = { commercialName: 'ACME', isActive: true }

describe('clients service', () => {
  let db: Db
  let ctx: Ctx
  let otherCtx: Ctx

  beforeAll(async () => {
    db = await createTestDb()
    const [orgA] = await db.insert(organizations).values({ name: 'A' }).returning()
    const [orgB] = await db.insert(organizations).values({ name: 'B' }).returning()
    const [ua] = await db.insert(users).values({ organizationId: orgA.id, name: 'Ana', email: 'a@x.com', passwordHash: 'x' }).returning()
    const [ub] = await db.insert(users).values({ organizationId: orgB.id, name: 'Bea', email: 'b@x.com', passwordHash: 'x' }).returning()
    ctx = { orgId: orgA.id, userId: ua.id }
    otherCtx = { orgId: orgB.id, userId: ub.id }
  })

  it('creates a client and logs the activity', async () => {
    const client = await createClient(db, ctx, { ...INPUT, hourlyRate: 800 })
    expect(client.commercialName).toBe('ACME')
    expect(client.hourlyRate).toBe('800.00') // numeric(10,2) llega como string con escala
    const logs = await db.select().from(activityLog).where(eq(activityLog.entityId, client.id))
    expect(logs).toHaveLength(1)
    expect(logs[0].action).toBe('created')
  })

  it('never leaks clients across organizations', async () => {
    await createClient(db, otherCtx, { commercialName: 'Ajena', isActive: true })
    const names = (await listClients(db, ctx)).map((c) => c.commercialName)
    expect(names).toContain('ACME')
    expect(names).not.toContain('Ajena')
    const foreign = (await listClients(db, otherCtx)).find((c) => c.commercialName === 'Ajena')
    expect(await getClient(db, ctx, foreign!.id)).toBeNull()
  })

  it('updates a client and logs before/after', async () => {
    const client = await createClient(db, ctx, { commercialName: 'Viejo', isActive: true })
    const updated = await updateClient(db, ctx, client.id, { commercialName: 'Nuevo', isActive: true })
    expect(updated.commercialName).toBe('Nuevo')
    const logs = await db.select().from(activityLog).where(eq(activityLog.entityId, client.id))
    const upd = logs.find((l) => l.action === 'updated')
    expect(upd?.changes).toMatchObject({ before: { commercialName: 'Viejo' }, after: { commercialName: 'Nuevo' } })
  })

  it('rejects updating a client from another organization', async () => {
    const foreign = (await listClients(db, otherCtx))[0]
    await expect(updateClient(db, ctx, foreign.id, INPUT)).rejects.toThrow(DomainError)
  })

  it('archives instead of deleting and hides archived clients', async () => {
    const client = await createClient(db, ctx, { commercialName: 'Temporal', isActive: true })
    await archiveClient(db, ctx, client.id)
    expect(await getClient(db, ctx, client.id)).toBeNull()
    expect((await listClients(db, ctx)).map((c) => c.id)).not.toContain(client.id)
    const [raw] = await db.select().from(clients).where(eq(clients.id, client.id))
    expect(raw.deletedAt).not.toBeNull()
  })
})
```

- [x] **Step 3: Correr y verificar que falla**

Run: `npm test`
Expected: FAIL — `./service` no existe en clients.

- [x] **Step 4: Implementar `src/modules/clients/service.ts`**

```ts
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
```

- [x] **Step 5: Correr los tests y verificar que pasan**

Run: `npm test`
Expected: PASS

- [x] **Step 6: Commit**

```bash
git add src/modules/clients/
git commit -m "feat: add clients validation and service"
```

---

### Task 4: Clientes — Server Actions y UI

**Files:**
- Create: `src/modules/clients/actions.ts`, `src/modules/clients/client-form.tsx`
- Create: `src/app/(app)/clientes/page.tsx`, `src/app/(app)/clientes/nuevo/page.tsx`, `src/app/(app)/clientes/[id]/page.tsx`, `src/app/(app)/clientes/[id]/editar/page.tsx`

**Interfaces:**
- Consumes: service y validación de Task 3, `requireCtx`, `ActionResult`, `fieldErrorsOf`, componentes shadcn
- Produces: el patrón action+form que replican Tasks 7, 8, 9, 11:
  - `createClientAction(prev: ActionResult | null, formData: FormData): Promise<ActionResult>`
  - `updateClientAction(id: string, prev: ActionResult | null, formData: FormData): Promise<ActionResult>` (se usa con `.bind(null, id)`)
  - `archiveClientAction(id: string): Promise<void>`
  - `<ClientForm action={...} client={...} />` con errores por campo

- [x] **Step 1: Crear `src/modules/clients/actions.ts`**

```ts
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
```

- [x] **Step 2: Crear `src/modules/clients/client-form.tsx`**

```tsx
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
```

Nota: `Field` se exporta porque los formularios de proyectos (Task 7), subproyectos/hitos (Tasks 8-9) y tareas (Task 11) lo reutilizan.

- [x] **Step 3: Crear las páginas**

`src/app/(app)/clientes/page.tsx`:

```tsx
import Link from 'next/link'
import { db } from '@/db'
import { requireCtx } from '@/lib/session'
import { listClients } from '@/modules/clients/service'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export default async function ClientsPage() {
  const ctx = await requireCtx()
  const rows = await listClients(db, ctx)
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Clientes</h1>
        <Button asChild><Link href="/clientes/nuevo">Nuevo cliente</Link></Button>
      </div>
      {rows.length === 0 ? (
        <p className="text-gray-500">Aún no hay clientes. Crea el primero.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre comercial</TableHead>
              <TableHead>Contacto</TableHead>
              <TableHead>Tarifa/h</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((c) => (
              <TableRow key={c.id}>
                <TableCell><Link className="font-medium hover:underline" href={`/clientes/${c.id}`}>{c.commercialName}</Link></TableCell>
                <TableCell>{c.contactName ?? '—'}</TableCell>
                <TableCell>{c.hourlyRate ? `$${c.hourlyRate}` : '—'}</TableCell>
                <TableCell><Badge variant={c.isActive ? 'default' : 'secondary'}>{c.isActive ? 'Activo' : 'Inactivo'}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
```

`src/app/(app)/clientes/nuevo/page.tsx`:

```tsx
import { ClientForm } from '@/modules/clients/client-form'
import { createClientAction } from '@/modules/clients/actions'

export default function NewClientPage() {
  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Nuevo cliente</h1>
      <ClientForm action={createClientAction} />
    </div>
  )
}
```

`src/app/(app)/clientes/[id]/page.tsx`:

```tsx
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/db'
import { requireCtx } from '@/lib/session'
import { getClient } from '@/modules/clients/service'
import { archiveClientAction } from '@/modules/clients/actions'
import { Button } from '@/components/ui/button'

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await requireCtx()
  const client = await getClient(db, ctx, id)
  if (!client) notFound()
  return (
    <div className="max-w-2xl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{client.commercialName}</h1>
        <div className="flex gap-2">
          <Button variant="outline" asChild><Link href={`/clientes/${client.id}/editar`}>Editar</Link></Button>
          <form action={archiveClientAction.bind(null, client.id)}>
            <Button variant="destructive" type="submit">Archivar</Button>
          </form>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
        <div><dt className="text-gray-500">Razón social</dt><dd>{client.legalName ?? '—'}</dd></div>
        <div><dt className="text-gray-500">Contacto</dt><dd>{client.contactName ?? '—'}</dd></div>
        <div><dt className="text-gray-500">Correo</dt><dd>{client.email ?? '—'}</dd></div>
        <div><dt className="text-gray-500">Teléfono</dt><dd>{client.phone ?? '—'}</dd></div>
        <div><dt className="text-gray-500">Tarifa por hora</dt><dd>{client.hourlyRate ? `$${client.hourlyRate}` : '—'}</dd></div>
        <div><dt className="text-gray-500">Estado</dt><dd>{client.isActive ? 'Activo' : 'Inactivo'}</dd></div>
        <div className="col-span-2"><dt className="text-gray-500">Notas</dt><dd className="whitespace-pre-wrap">{client.notes ?? '—'}</dd></div>
      </dl>
      <p className="mt-6 text-sm text-gray-400">Los proyectos del cliente se listan aquí a partir de la Task 7.</p>
    </div>
  )
}
```

`src/app/(app)/clientes/[id]/editar/page.tsx`:

```tsx
import { notFound } from 'next/navigation'
import { db } from '@/db'
import { requireCtx } from '@/lib/session'
import { getClient } from '@/modules/clients/service'
import { updateClientAction } from '@/modules/clients/actions'
import { ClientForm } from '@/modules/clients/client-form'

export default async function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await requireCtx()
  const client = await getClient(db, ctx, id)
  if (!client) notFound()
  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Editar cliente</h1>
      <ClientForm action={updateClientAction.bind(null, client.id)} client={client} />
    </div>
  )
}
```

- [x] **Step 4: Verificación manual y checks**

Run: `npm run lint && npm run typecheck && npm test && npm run build`
Expected: en verde.
Con `npm run dev`: crear un cliente con tarifa, verlo en la lista, editarlo, archivar otro y confirmar que desaparece. Enviar el formulario con correo inválido → error en español junto al campo.

- [x] **Step 5: Commit**

```bash
git add src/modules/clients/ "src/app/(app)/clientes/"
git commit -m "feat: add clients CRUD pages"
```

> **Nota de ejecución (Task 4):** además de lo planeado, `getClient` ahora valida la forma UUID del id y devuelve `null` si no coincide (hallazgo del review de la Task 3): los params de la ruta `/clientes/[id]` llegan tal cual al service y un id no-UUID abortaba con error 22P02 de Postgres (500) en vez de renderizar el 404. Cubierto con test. Por code review se agregó también `src/app/(app)/error.tsx` (no existía ningún error boundary: un `DomainError` sin manejar en `archiveClientAction` — p. ej. doble clic — mostraba la pantalla de error cruda de Next; las actions de las Tasks 7-9/11 clonan este patrón) y el `min` del input de tarifa pasó a `0.01` para coincidir con el `.positive()` del schema. La verificación manual con `npm run dev` quedó pendiente para Pablo (el agente no tiene credenciales de login); los checks automáticos (lint, typecheck, 44 tests, build con las 4 rutas) pasaron.

---

### Task 5: Estados personalizados — service y pantalla de configuración

**Files:**
- Create: `src/modules/customization/validation.ts`, `src/modules/customization/service.ts`, `src/modules/customization/service.test.ts`, `src/modules/customization/actions.ts`, `src/modules/customization/status-manager.tsx`
- Create: `src/app/(app)/configuracion/estados/page.tsx`

**Interfaces:**
- Consumes: `customStatuses` schema, `STATUS_CATALOGS` (tipos), tablas `projects/subprojects/milestones/tasks` (guard de "en uso"), `Ctx`, `DomainError`, `logActivity`
- Produces (los usan Tasks 6–12):
  - `listStatuses(db: Db, ctx: Ctx, entityType: StatusEntityType): Promise<CustomStatus[]>` (orden `sortOrder`)
  - `getDefaultStatus(db: Db, ctx: Ctx, entityType: StatusEntityType): Promise<CustomStatus>` (lanza `DomainError` si el catálogo está vacío)
  - `createStatus(db, ctx, input: StatusInput): Promise<CustomStatus>` — `StatusInput = { entityType: StatusEntityType; name: string; category: StatusCategory | null; color?: string }`; `sortOrder` = max+1; `category` obligatoria salvo `project_health`
  - `updateStatus(db, ctx, id, input: { name: string; color?: string }): Promise<CustomStatus>` (la categoría NO es editable: preserva la semántica de reportes, spec §4.5)
  - `deleteStatus(db, ctx, id): Promise<void>` — `DomainError` si es default o está en uso (referenciado por `status_id`/`health_id` en projects, subprojects, milestones o tasks)
  - `moveStatus(db, ctx, id, direction: 'up' | 'down'): Promise<void>` (intercambia `sortOrder` con el vecino)
  - `CustomStatus = typeof customStatuses.$inferSelect`

- [ ] **Step 1: Crear `src/modules/customization/validation.ts`**

```ts
import { z } from 'zod'
import { emptyToUndefined } from '@/lib/zod-utils'

export const statusEntityTypes = ['project', 'project_health', 'milestone', 'task'] as const
export const statusCategories = ['open', 'in_progress', 'blocked', 'done', 'cancelled'] as const

export const statusInputSchema = z.object({
  entityType: z.enum(statusEntityTypes),
  name: z.string().trim().min(1, 'El nombre es obligatorio').max(100),
  category: z.preprocess(emptyToUndefined, z.enum(statusCategories).optional()),
  color: z.preprocess(emptyToUndefined, z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color inválido').optional()),
})

export const statusUpdateSchema = statusInputSchema.pick({ name: true, color: true })
```

- [ ] **Step 2: Escribir el test que falla — `src/modules/customization/service.test.ts`**

```ts
import { beforeAll, describe, expect, it } from 'vitest'
import type { Db } from '@/db'
import { createTestDb } from '@/test/db'
import { organizations } from '@/modules/organization/schema'
import { users } from '@/modules/auth/schema'
import { clients } from '@/modules/clients/schema'
import { projects } from '@/modules/projects/schema'
import type { Ctx } from '@/lib/ctx'
import { DomainError } from '@/lib/errors'
import { seed } from '@/db/seed'
import { createStatus, deleteStatus, getDefaultStatus, listStatuses, moveStatus, updateStatus } from './service'

describe('custom statuses service', () => {
  let db: Db
  let ctx: Ctx

  beforeAll(async () => {
    db = await createTestDb()
    await seed(db, { orgName: 'Org', adminEmail: 'a@x.com', adminPassword: 'x', adminName: 'Ana' })
    const [org] = await db.select().from(organizations)
    const [user] = await db.select().from(users)
    ctx = { orgId: org.id, userId: user.id }
  })

  it('lists the seeded task statuses in order', async () => {
    const statuses = await listStatuses(db, ctx, 'task')
    expect(statuses.map((s) => s.name)).toEqual(['Pendiente', 'En progreso', 'En revisión', 'Bloqueada', 'Completada', 'Cancelada'])
  })

  it('returns the default status per entity type', async () => {
    expect((await getDefaultStatus(db, ctx, 'project')).name).toBe('Borrador')
    expect((await getDefaultStatus(db, ctx, 'task')).name).toBe('Pendiente')
  })

  it('creates a status at the end and renames it without touching its category', async () => {
    const created = await createStatus(db, ctx, { entityType: 'task', name: 'QA', category: 'in_progress' })
    const all = await listStatuses(db, ctx, 'task')
    expect(all[all.length - 1].name).toBe('QA')
    const renamed = await updateStatus(db, ctx, created.id, { name: 'QA interno' })
    expect(renamed.name).toBe('QA interno')
    expect(renamed.category).toBe('in_progress')
  })

  it('requires a category except for project_health', async () => {
    await expect(createStatus(db, ctx, { entityType: 'task', name: 'Sin cat', category: null })).rejects.toThrow(DomainError)
    const health = await createStatus(db, ctx, { entityType: 'project_health', name: 'Crítico', category: null })
    expect(health.category).toBeNull()
  })

  it('refuses to delete the default status or one in use', async () => {
    const def = await getDefaultStatus(db, ctx, 'project')
    await expect(deleteStatus(db, ctx, def.id)).rejects.toThrow(DomainError)

    const active = (await listStatuses(db, ctx, 'project')).find((s) => s.name === 'Activo')!
    const [client] = await db.insert(clients).values({ organizationId: ctx.orgId, commercialName: 'C' }).returning()
    await db.insert(projects).values({ organizationId: ctx.orgId, clientId: client.id, name: 'P', responsibleId: ctx.userId, statusId: active.id })
    await expect(deleteStatus(db, ctx, active.id)).rejects.toThrow(DomainError)

    const disposable = await createStatus(db, ctx, { entityType: 'project', name: 'Borrable', category: 'open' })
    await deleteStatus(db, ctx, disposable.id)
    expect((await listStatuses(db, ctx, 'project')).map((s) => s.name)).not.toContain('Borrable')
  })

  it('reorders statuses swapping with the neighbor', async () => {
    const before = await listStatuses(db, ctx, 'milestone')
    await moveStatus(db, ctx, before[1].id, 'up')
    const after = await listStatuses(db, ctx, 'milestone')
    expect(after[0].id).toBe(before[1].id)
    expect(after[1].id).toBe(before[0].id)
    await moveStatus(db, ctx, after[0].id, 'up') // ya es el primero: no-op sin error
    expect((await listStatuses(db, ctx, 'milestone'))[0].id).toBe(after[0].id)
  })
})
```

- [ ] **Step 3: Correr y verificar que falla**

Run: `npm test`
Expected: FAIL — `./service` no existe en customization.

- [ ] **Step 4: Implementar `src/modules/customization/service.ts`**

```ts
import { and, asc, eq, isNull, or, sql } from 'drizzle-orm'
import type { Db } from '@/db'
import type { Ctx } from '@/lib/ctx'
import { DomainError } from '@/lib/errors'
import { logActivity } from '@/modules/collaboration/service'
import { customStatuses } from './schema'
import type { StatusCategory, StatusEntityType } from './catalogs'
import { milestones, projects, subprojects } from '@/modules/projects/schema'
import { tasks } from '@/modules/tasks/schema'

export type CustomStatus = typeof customStatuses.$inferSelect

export interface StatusInput {
  entityType: StatusEntityType
  name: string
  category: StatusCategory | null
  color?: string
}

const byOrg = (ctx: Ctx) => eq(customStatuses.organizationId, ctx.orgId)

export async function listStatuses(db: Db, ctx: Ctx, entityType: StatusEntityType): Promise<CustomStatus[]> {
  return db
    .select()
    .from(customStatuses)
    .where(and(byOrg(ctx), eq(customStatuses.entityType, entityType)))
    .orderBy(asc(customStatuses.sortOrder), asc(customStatuses.createdAt))
}

export async function getDefaultStatus(db: Db, ctx: Ctx, entityType: StatusEntityType): Promise<CustomStatus> {
  const all = await listStatuses(db, ctx, entityType)
  const found = all.find((s) => s.isDefault) ?? all[0]
  if (!found) throw new DomainError('No hay estados configurados para esta entidad')
  return found
}

export async function createStatus(db: Db, ctx: Ctx, input: StatusInput): Promise<CustomStatus> {
  if (input.entityType !== 'project_health' && !input.category)
    throw new DomainError('La categoría es obligatoria para este tipo de entidad')
  const existing = await listStatuses(db, ctx, input.entityType)
  const sortOrder = existing.length ? Math.max(...existing.map((s) => s.sortOrder)) + 1 : 0
  const [status] = await db
    .insert(customStatuses)
    .values({
      organizationId: ctx.orgId,
      entityType: input.entityType,
      name: input.name,
      category: input.entityType === 'project_health' ? null : input.category,
      color: input.color ?? null,
      sortOrder,
    })
    .returning()
  await logActivity(db, ctx, { entityType: 'custom_status', entityId: status.id, action: 'created' })
  return status
}

async function getOwnStatus(db: Db, ctx: Ctx, id: string): Promise<CustomStatus> {
  const [status] = await db.select().from(customStatuses).where(and(byOrg(ctx), eq(customStatuses.id, id)))
  if (!status) throw new DomainError('Estado no encontrado')
  return status
}

export async function updateStatus(db: Db, ctx: Ctx, id: string, input: { name: string; color?: string }): Promise<CustomStatus> {
  const before = await getOwnStatus(db, ctx, id)
  const [status] = await db
    .update(customStatuses)
    .set({ name: input.name, color: input.color ?? null, updatedAt: new Date() })
    .where(and(byOrg(ctx), eq(customStatuses.id, id)))
    .returning()
  await logActivity(db, ctx, {
    entityType: 'custom_status',
    entityId: id,
    action: 'updated',
    changes: { before: { name: before.name }, after: { name: status.name } },
  })
  return status
}

async function statusInUse(db: Db, ctx: Ctx, id: string): Promise<boolean> {
  const count = sql<number>`count(*)::int`
  const [p] = await db
    .select({ n: count })
    .from(projects)
    .where(and(eq(projects.organizationId, ctx.orgId), isNull(projects.deletedAt), or(eq(projects.statusId, id), eq(projects.healthId, id))))
  const [s] = await db
    .select({ n: count })
    .from(subprojects)
    .where(and(eq(subprojects.organizationId, ctx.orgId), isNull(subprojects.deletedAt), eq(subprojects.statusId, id)))
  const [m] = await db
    .select({ n: count })
    .from(milestones)
    .where(and(eq(milestones.organizationId, ctx.orgId), isNull(milestones.deletedAt), eq(milestones.statusId, id)))
  const [t] = await db
    .select({ n: count })
    .from(tasks)
    .where(and(eq(tasks.organizationId, ctx.orgId), isNull(tasks.deletedAt), eq(tasks.statusId, id)))
  return p.n + s.n + m.n + t.n > 0
}

export async function deleteStatus(db: Db, ctx: Ctx, id: string): Promise<void> {
  const status = await getOwnStatus(db, ctx, id)
  if (status.isDefault) throw new DomainError('No se puede eliminar el estado por defecto')
  if (await statusInUse(db, ctx, id)) throw new DomainError('El estado está en uso y no se puede eliminar')
  await db.delete(customStatuses).where(and(byOrg(ctx), eq(customStatuses.id, id)))
  await logActivity(db, ctx, { entityType: 'custom_status', entityId: id, action: 'deleted' })
}

export async function moveStatus(db: Db, ctx: Ctx, id: string, direction: 'up' | 'down'): Promise<void> {
  const status = await getOwnStatus(db, ctx, id)
  const siblings = await listStatuses(db, ctx, status.entityType as StatusEntityType)
  const idx = siblings.findIndex((s) => s.id === id)
  const swapWith = direction === 'up' ? siblings[idx - 1] : siblings[idx + 1]
  if (!swapWith) return
  await db.update(customStatuses).set({ sortOrder: swapWith.sortOrder, updatedAt: new Date() }).where(eq(customStatuses.id, status.id))
  await db.update(customStatuses).set({ sortOrder: status.sortOrder, updatedAt: new Date() }).where(eq(customStatuses.id, swapWith.id))
}
```

Nota: `statusInUse` usa `count`, no trae filas; los archivados (soft-deleted) no bloquean la eliminación.

- [ ] **Step 5: Correr los tests y verificar que pasan**

Run: `npm test`
Expected: PASS

- [ ] **Step 6: Crear `src/modules/customization/actions.ts`**

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { requireCtx } from '@/lib/session'
import { DomainError } from '@/lib/errors'
import type { ActionResult } from '@/lib/action-result'
import { fieldErrorsOf } from '@/lib/zod-utils'
import { statusInputSchema, statusUpdateSchema } from './validation'
import { createStatus, deleteStatus, moveStatus, updateStatus } from './service'
import type { StatusEntityType } from './catalogs'

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

export type { StatusEntityType }
```

- [ ] **Step 7: Crear `src/modules/customization/status-manager.tsx`**

```tsx
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
  const [, startTransition] = useTransition()
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
      <Button size="sm" variant="ghost" disabled={first} onClick={() => act(() => moveStatusAction(status.id, 'up'))}>↑</Button>
      <Button size="sm" variant="ghost" disabled={last} onClick={() => act(() => moveStatusAction(status.id, 'down'))}>↓</Button>
      <Button size="sm" variant="ghost" className="text-red-600" disabled={status.isDefault}
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
```

- [ ] **Step 8: Crear `src/app/(app)/configuracion/estados/page.tsx`**

```tsx
import { db } from '@/db'
import { requireCtx } from '@/lib/session'
import { listStatuses } from '@/modules/customization/service'
import { StatusManager } from '@/modules/customization/status-manager'

const SECTIONS = [
  { entityType: 'project', title: 'Proyectos y subproyectos', allowCategory: true },
  { entityType: 'project_health', title: 'Salud del proyecto', allowCategory: false },
  { entityType: 'milestone', title: 'Hitos', allowCategory: true },
  { entityType: 'task', title: 'Tareas', allowCategory: true },
] as const

export default async function StatusesSettingsPage() {
  const ctx = await requireCtx()
  const sections = await Promise.all(
    SECTIONS.map(async (s) => ({ ...s, statuses: await listStatuses(db, ctx, s.entityType) })),
  )
  return (
    <div className="max-w-3xl space-y-8">
      <h1 className="text-2xl font-semibold">Configuración — Estados</h1>
      <p className="text-sm text-gray-500">
        Renombra, reordena o agrega estados. La categoría del sistema no cambia al renombrar: reportes y Kanban siguen funcionando.
      </p>
      {sections.map((s) => (
        <section key={s.entityType}>
          <h2 className="mb-2 text-lg font-medium">{s.title}</h2>
          <StatusManager entityType={s.entityType} statuses={s.statuses} allowCategory={s.allowCategory} />
        </section>
      ))}
    </div>
  )
}
```

- [ ] **Step 9: Verificación y commit**

Run: `npm run lint && npm run typecheck && npm test && npm run build`
Expected: en verde.
Con `npm run dev` en `/configuracion/estados`: renombrar un estado, agregar uno nuevo con categoría, reordenarlo, intentar eliminar el default (error en español) y eliminar el nuevo.

```bash
git add src/modules/customization/ "src/app/(app)/configuracion/"
git commit -m "feat: add custom statuses management"
```

---

### Task 6: Proyectos — validación y service con participantes

**Files:**
- Create: `src/modules/projects/validation.ts`, `src/modules/projects/service.ts`, `src/modules/projects/service.test.ts`
- Modify: `src/modules/auth/service.ts` (agregar `listActiveUsers`)

**Interfaces:**
- Consumes: schemas de projects/clients/customization, `getClient` (Task 3), `getDefaultStatus`/`listStatuses` (Task 5), `logActivity`, `Ctx`, `DomainError`
- Produces (los usan Tasks 7–12):
  - `listActiveUsers(db: Db, orgId: string): Promise<{ id: string; name: string; email: string }[]>` en `@/modules/auth/service`
  - `projectInputSchema` / `ProjectInput` en `@/modules/projects/validation` — campos: `clientId` (uuid), `name`, `description?`, `responsibleId` (uuid), `statusId?` (uuid), `healthId?` (uuid), `priority` (`'low'|'medium'|'high'|'urgent'`, default `'medium'`), `startDate?`/`dueDate?` (string `YYYY-MM-DD`), `budgetedHours?` (number), `hourlyRate?` (number), `memberIds` (uuid[], default `[]`)
  - En `@/modules/projects/service`:
    - `listProjects(db, ctx, filter?: { clientId?: string }): Promise<ProjectListItem[]>` — `ProjectListItem = { project: Project; clientName: string; status: CustomStatus }`
    - `getProject(db, ctx, id): Promise<Project | null>`
    - `getProjectDetail(db, ctx, id): Promise<ProjectDetail | null>` — `ProjectDetail = { project: Project; clientName: string; status: CustomStatus; health: CustomStatus | null; responsibleName: string; members: { id: string; name: string }[] }`
    - `createProject(db, ctx, input: ProjectInput): Promise<Project>` — valida cliente/responsable/estado de la org; sin `statusId` usa el default `'project'`
    - `updateProject(db, ctx, id, input: ProjectInput): Promise<Project>` — registra `status_changed` con antes/después cuando cambia el estado
    - `archiveProject(db, ctx, id): Promise<void>`
  - `Project = typeof projects.$inferSelect`

- [ ] **Step 1: Agregar `listActiveUsers` a `src/modules/auth/service.ts`**

Al final del archivo:

```ts
/** Users selectable as responsible/assignee/member in forms. */
export async function listActiveUsers(db: Db, orgId: string): Promise<{ id: string; name: string; email: string }[]> {
  const rows = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(and(eq(users.organizationId, orgId), eq(users.isActive, true), isNull(users.deletedAt)))
    .orderBy(users.name)
  return rows
}
```

(`and`, `eq`, `isNull` ya están importados en ese archivo desde el fix de la Iteración 0.)

- [ ] **Step 2: Crear `src/modules/projects/validation.ts`**

```ts
import { z } from 'zod'
import { emptyToUndefined } from '@/lib/zod-utils'

const optionalDate = z.preprocess(emptyToUndefined, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida').optional())
const optionalPositive = z.preprocess(
  emptyToUndefined,
  z.coerce.number({ message: 'Debe ser un número' }).positive('Debe ser mayor a 0').optional(),
)
const uuid = (msg: string) => z.string().uuid(msg)

export const projectInputSchema = z.object({
  clientId: uuid('Selecciona un cliente'),
  name: z.string().trim().min(1, 'El nombre es obligatorio').max(200),
  description: z.preprocess(emptyToUndefined, z.string().trim().max(5000).optional()),
  responsibleId: uuid('Selecciona un responsable'),
  statusId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  healthId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  startDate: optionalDate,
  dueDate: optionalDate,
  /** Presupuesto manual (spec §12.3): no se calcula, se captura. */
  budgetedHours: optionalPositive,
  /** Sobrescribe la tarifa del cliente (spec §12.4). */
  hourlyRate: optionalPositive,
  memberIds: z.array(z.string().uuid()).default([]),
})

export type ProjectInput = z.infer<typeof projectInputSchema>
```

Nota para las actions (Task 7): `memberIds` viene de un `<select multiple>`; usar `formData.getAll('memberIds')` al armar el objeto antes de `safeParse`.

- [ ] **Step 3: Escribir el test que falla — `src/modules/projects/service.test.ts`**

Ya existe un archivo con tests del **schema** (Iteración 0); estos tests del **service** van en el mismo archivo, en un `describe` nuevo al final:

```ts
import { seed } from '@/db/seed'
import { DomainError } from '@/lib/errors'
import type { Ctx } from '@/lib/ctx'
import { activityLog } from '@/modules/collaboration/schema'
import { projectMembers } from './schema'
import { archiveProject, createProject, getProjectDetail, listProjects, updateProject } from './service'

describe('projects service', () => {
  let db: Db
  let ctx: Ctx
  let clientId: string
  let userId: string

  beforeAll(async () => {
    db = await createTestDb()
    await seed(db, { orgName: 'Org', adminEmail: 'adm@x.com', adminPassword: 'x', adminName: 'Admin' })
    const [org] = await db.select().from(organizations)
    const [user] = await db.select().from(users)
    userId = user.id
    ctx = { orgId: org.id, userId }
    const [client] = await db.insert(clients).values({ organizationId: org.id, commercialName: 'ACME' }).returning()
    clientId = client.id
  })

  const base = () => ({ clientId, name: 'Sitio', responsibleId: userId, priority: 'medium' as const, memberIds: [] })

  it('creates a project with the default status and logs it', async () => {
    const project = await createProject(db, ctx, base())
    const detail = await getProjectDetail(db, ctx, project.id)
    expect(detail?.status.name).toBe('Borrador')
    expect(detail?.clientName).toBe('ACME')
    const logs = await db.select().from(activityLog).where(eq(activityLog.entityId, project.id))
    expect(logs.map((l) => l.action)).toContain('created')
  })

  it('stores members and returns them in the detail', async () => {
    const project = await createProject(db, ctx, { ...base(), name: 'Con equipo', memberIds: [userId] })
    const detail = await getProjectDetail(db, ctx, project.id)
    expect(detail?.members.map((m) => m.id)).toEqual([userId])
  })

  it('rejects a client from another organization', async () => {
    const [orgB] = await db.insert(organizations).values({ name: 'B' }).returning()
    const [foreign] = await db.insert(clients).values({ organizationId: orgB.id, commercialName: 'Ajena' }).returning()
    await expect(createProject(db, ctx, { ...base(), clientId: foreign.id })).rejects.toThrow(DomainError)
  })

  it('logs status_changed with before/after names on update', async () => {
    const project = await createProject(db, ctx, { ...base(), name: 'Cambia estado' })
    const activo = (await listStatuses(db, ctx, 'project')).find((s) => s.name === 'Activo')!
    await updateProject(db, ctx, project.id, { ...base(), name: 'Cambia estado', statusId: activo.id })
    const logs = await db.select().from(activityLog).where(eq(activityLog.entityId, project.id))
    const change = logs.find((l) => l.action === 'status_changed')
    expect(change?.changes).toEqual({ before: { status: 'Borrador' }, after: { status: 'Activo' } })
  })

  it('archives and disappears from listings', async () => {
    const project = await createProject(db, ctx, { ...base(), name: 'Efímero' })
    await archiveProject(db, ctx, project.id)
    expect((await listProjects(db, ctx)).map((p) => p.project.id)).not.toContain(project.id)
    const memberships = await db.select().from(projectMembers).where(eq(projectMembers.projectId, project.id))
    expect(memberships).toHaveLength(0) // members cleaned on archive
  })
})
```

Agregar los imports nuevos junto a los existentes del archivo (`seed`, `DomainError`, `Ctx`, `activityLog`, `projectMembers`, funciones del service y `listStatuses` de `@/modules/customization/service`).

- [ ] **Step 4: Correr y verificar que falla**

Run: `npm test`
Expected: FAIL — `./service` no existe en projects.

- [ ] **Step 5: Implementar `src/modules/projects/service.ts`**

```ts
import { and, eq, inArray, isNull } from 'drizzle-orm'
import type { Db } from '@/db'
import type { Ctx } from '@/lib/ctx'
import { DomainError } from '@/lib/errors'
import { logActivity } from '@/modules/collaboration/service'
import { getClient } from '@/modules/clients/service'
import { clients } from '@/modules/clients/schema'
import { users } from '@/modules/auth/schema'
import { customStatuses } from '@/modules/customization/schema'
import { getDefaultStatus } from '@/modules/customization/service'
import type { CustomStatus } from '@/modules/customization/service'
import { projectMembers, projects } from './schema'
import type { ProjectInput } from './validation'

export type Project = typeof projects.$inferSelect
export interface ProjectListItem { project: Project; clientName: string; status: CustomStatus }
export interface ProjectDetail extends ProjectListItem {
  health: CustomStatus | null
  responsibleName: string
  members: { id: string; name: string }[]
}

const scope = (ctx: Ctx, id?: string) =>
  and(eq(projects.organizationId, ctx.orgId), isNull(projects.deletedAt), ...(id ? [eq(projects.id, id)] : []))

/** Cross-tenant guards: every FK the form sends must belong to ctx.orgId (spec §4.1). */
async function assertReferences(db: Db, ctx: Ctx, input: ProjectInput): Promise<void> {
  if (!(await getClient(db, ctx, input.clientId))) throw new DomainError('Cliente no encontrado')
  const people = [input.responsibleId, ...input.memberIds]
  const found = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.organizationId, ctx.orgId), inArray(users.id, people)))
  if (found.length !== new Set(people).size) throw new DomainError('Usuario no encontrado')
  for (const [id, entityType] of [
    [input.statusId, 'project'],
    [input.healthId, 'project_health'],
  ] as const) {
    if (!id) continue
    const [status] = await db
      .select()
      .from(customStatuses)
      .where(and(eq(customStatuses.organizationId, ctx.orgId), eq(customStatuses.id, id), eq(customStatuses.entityType, entityType)))
    if (!status) throw new DomainError('Estado no válido')
  }
}

const toRow = (input: ProjectInput) => ({
  clientId: input.clientId,
  name: input.name,
  description: input.description ?? null,
  responsibleId: input.responsibleId,
  healthId: input.healthId ?? null,
  priority: input.priority,
  startDate: input.startDate ?? null,
  dueDate: input.dueDate ?? null,
  budgetedHours: input.budgetedHours != null ? String(input.budgetedHours) : null,
  hourlyRate: input.hourlyRate != null ? String(input.hourlyRate) : null,
})

async function replaceMembers(db: Db, projectId: string, memberIds: string[]): Promise<void> {
  await db.delete(projectMembers).where(eq(projectMembers.projectId, projectId))
  if (memberIds.length) await db.insert(projectMembers).values(memberIds.map((userId) => ({ projectId, userId })))
}

export async function createProject(db: Db, ctx: Ctx, input: ProjectInput): Promise<Project> {
  await assertReferences(db, ctx, input)
  const statusId = input.statusId ?? (await getDefaultStatus(db, ctx, 'project')).id
  const [project] = await db
    .insert(projects)
    .values({ organizationId: ctx.orgId, statusId, ...toRow(input) })
    .returning()
  await replaceMembers(db, project.id, input.memberIds)
  await logActivity(db, ctx, { entityType: 'project', entityId: project.id, action: 'created' })
  return project
}

export async function getProject(db: Db, ctx: Ctx, id: string): Promise<Project | null> {
  const [project] = await db.select().from(projects).where(scope(ctx, id))
  return project ?? null
}

export async function listProjects(db: Db, ctx: Ctx, filter?: { clientId?: string }): Promise<ProjectListItem[]> {
  const rows = await db
    .select({ project: projects, clientName: clients.commercialName, status: customStatuses })
    .from(projects)
    .innerJoin(clients, eq(projects.clientId, clients.id))
    .innerJoin(customStatuses, eq(projects.statusId, customStatuses.id))
    .where(and(scope(ctx), ...(filter?.clientId ? [eq(projects.clientId, filter.clientId)] : [])))
    .orderBy(projects.name)
  return rows
}

export async function getProjectDetail(db: Db, ctx: Ctx, id: string): Promise<ProjectDetail | null> {
  const project = await getProject(db, ctx, id)
  if (!project) return null
  const [client] = await db.select().from(clients).where(eq(clients.id, project.clientId))
  const [status] = await db.select().from(customStatuses).where(eq(customStatuses.id, project.statusId))
  const health = project.healthId
    ? (await db.select().from(customStatuses).where(eq(customStatuses.id, project.healthId)))[0] ?? null
    : null
  const [responsible] = await db.select().from(users).where(eq(users.id, project.responsibleId))
  const members = await db
    .select({ id: users.id, name: users.name })
    .from(projectMembers)
    .innerJoin(users, eq(projectMembers.userId, users.id))
    .where(eq(projectMembers.projectId, project.id))
  return { project, clientName: client.commercialName, status, health, responsibleName: responsible.name, members }
}

export async function updateProject(db: Db, ctx: Ctx, id: string, input: ProjectInput): Promise<Project> {
  const before = await getProjectDetail(db, ctx, id)
  if (!before) throw new DomainError('Proyecto no encontrado')
  await assertReferences(db, ctx, input)
  const statusId = input.statusId ?? before.project.statusId
  const [project] = await db
    .update(projects)
    .set({ statusId, ...toRow(input), updatedAt: new Date() })
    .where(scope(ctx, id))
    .returning()
  await replaceMembers(db, id, input.memberIds)
  if (statusId !== before.project.statusId) {
    const [after] = await db.select().from(customStatuses).where(eq(customStatuses.id, statusId))
    await logActivity(db, ctx, {
      entityType: 'project',
      entityId: id,
      action: 'status_changed',
      changes: { before: { status: before.status.name }, after: { status: after.name } },
    })
  } else {
    await logActivity(db, ctx, { entityType: 'project', entityId: id, action: 'updated' })
  }
  return project
}

export async function archiveProject(db: Db, ctx: Ctx, id: string): Promise<void> {
  const before = await getProject(db, ctx, id)
  if (!before) throw new DomainError('Proyecto no encontrado')
  await db.update(projects).set({ deletedAt: new Date(), updatedAt: new Date() }).where(scope(ctx, id))
  await db.delete(projectMembers).where(eq(projectMembers.projectId, id))
  await logActivity(db, ctx, { entityType: 'project', entityId: id, action: 'archived' })
}
```

- [ ] **Step 6: Correr los tests y verificar que pasan**

Run: `npm test`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/modules/projects/ src/modules/auth/service.ts
git commit -m "feat: add projects service with members and cross-tenant guards"
```

---

### Task 7: Proyectos — actions y UI (lista, formulario, detalle)

**Files:**
- Create: `src/modules/projects/actions.ts`, `src/modules/projects/project-form.tsx`
- Create: `src/app/(app)/proyectos/page.tsx`, `src/app/(app)/proyectos/nuevo/page.tsx`, `src/app/(app)/proyectos/[id]/page.tsx`, `src/app/(app)/proyectos/[id]/editar/page.tsx`
- Modify: `src/app/(app)/clientes/[id]/page.tsx` (listar proyectos del cliente)

**Interfaces:**
- Consumes: Task 6 (`listProjects`, `getProjectDetail`, `createProject`, `updateProject`, `archiveProject`, `projectInputSchema`, `listActiveUsers`), Task 5 (`listStatuses`), Task 3 (`listClients`), `Field` de Task 4
- Produces:
  - `createProjectAction(prev, formData)`, `updateProjectAction(id, prev, formData)`, `archiveProjectAction(id)` con las mismas firmas que las de clientes
  - `<ProjectForm action clients users statuses healths project detail />`
  - Página de detalle `/proyectos/[id]` con secciones vacías para subproyectos (Task 8), hitos (Task 9) y tareas (Task 11)

- [ ] **Step 1: Crear `src/modules/projects/actions.ts`**

Igual patrón que clientes; la única diferencia es armar el objeto con `getAll` para `memberIds`:

```ts
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
```

- [ ] **Step 2: Crear `src/modules/projects/project-form.tsx`**

```tsx
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
        <Input id="name" name="name" defaultValue={project?.name} required />
      </Field>
      <Field name="description" label="Descripción" errors={errs.description}>
        <Textarea id="description" name="description" defaultValue={project?.description ?? ''} rows={3} />
      </Field>
      <div className="grid grid-cols-3 gap-4">
        <Field name="statusId" label="Estado" errors={errs.statusId}>
          <select id="statusId" name="statusId" defaultValue={project?.statusId ?? ''} className={select}>
            {!project && <option value="">Default (Borrador)</option>}
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
        <Field name="budgetedHours" label="Horas presupuestadas" errors={errs.budgetedHours}>
          <Input id="budgetedHours" name="budgetedHours" type="number" step="0.25" min="0" defaultValue={project?.budgetedHours ?? ''} />
        </Field>
        <Field name="hourlyRate" label="Tarifa por hora (sobrescribe la del cliente)" errors={errs.hourlyRate}>
          <Input id="hourlyRate" name="hourlyRate" type="number" step="0.01" min="0" defaultValue={project?.hourlyRate ?? ''} />
        </Field>
      </div>
      <Field name="memberIds" label="Participantes (Ctrl/Cmd + clic para varios)" errors={errs.memberIds}>
        <select id="memberIds" name="memberIds" multiple size={Math.min(users.length, 5)}
          defaultValue={detail?.members.map((m) => m.id) ?? []} className="w-full rounded border p-2 text-sm">
          {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </Field>
      <Button type="submit" disabled={pending}>{pending ? 'Guardando…' : 'Guardar'}</Button>
    </form>
  )
}
```

- [ ] **Step 3: Crear las páginas de proyectos**

`src/app/(app)/proyectos/page.tsx`:

```tsx
import Link from 'next/link'
import { db } from '@/db'
import { requireCtx } from '@/lib/session'
import { listProjects } from '@/modules/projects/service'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const PRIORITY_LABELS: Record<string, string> = { low: 'Baja', medium: 'Media', high: 'Alta', urgent: 'Urgente' }

export default async function ProjectsPage() {
  const ctx = await requireCtx()
  const rows = await listProjects(db, ctx)
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Proyectos</h1>
        <Button asChild><Link href="/proyectos/nuevo">Nuevo proyecto</Link></Button>
      </div>
      {rows.length === 0 ? (
        <p className="text-gray-500">Aún no hay proyectos.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Proyecto</TableHead><TableHead>Cliente</TableHead>
              <TableHead>Estado</TableHead><TableHead>Prioridad</TableHead><TableHead>Compromiso</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(({ project, clientName, status }) => (
              <TableRow key={project.id}>
                <TableCell><Link className="font-medium hover:underline" href={`/proyectos/${project.id}`}>{project.name}</Link></TableCell>
                <TableCell>{clientName}</TableCell>
                <TableCell><Badge style={status.color ? { backgroundColor: status.color } : undefined}>{status.name}</Badge></TableCell>
                <TableCell>{PRIORITY_LABELS[project.priority]}</TableCell>
                <TableCell>{project.dueDate ?? '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
```

`src/app/(app)/proyectos/nuevo/page.tsx`:

```tsx
import { db } from '@/db'
import { requireCtx } from '@/lib/session'
import { listClients } from '@/modules/clients/service'
import { listActiveUsers } from '@/modules/auth/service'
import { listStatuses } from '@/modules/customization/service'
import { ProjectForm } from '@/modules/projects/project-form'
import { createProjectAction } from '@/modules/projects/actions'

export default async function NewProjectPage() {
  const ctx = await requireCtx()
  const [clients, users, statuses, healths] = await Promise.all([
    listClients(db, ctx),
    listActiveUsers(db, ctx.orgId),
    listStatuses(db, ctx, 'project'),
    listStatuses(db, ctx, 'project_health'),
  ])
  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Nuevo proyecto</h1>
      <ProjectForm
        action={createProjectAction}
        clients={clients.map((c) => ({ id: c.id, name: c.commercialName }))}
        users={users}
        statuses={statuses}
        healths={healths}
      />
    </div>
  )
}
```

`src/app/(app)/proyectos/[id]/page.tsx`:

```tsx
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/db'
import { requireCtx } from '@/lib/session'
import { getProjectDetail } from '@/modules/projects/service'
import { archiveProjectAction } from '@/modules/projects/actions'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await requireCtx()
  const detail = await getProjectDetail(db, ctx, id)
  if (!detail) notFound()
  const { project, clientName, status, health, responsibleName, members } = detail
  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{project.name}</h1>
          <p className="text-sm text-gray-500">{clientName}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild><Link href={`/proyectos/${project.id}/editar`}>Editar</Link></Button>
          <form action={archiveProjectAction.bind(null, project.id)}>
            <Button variant="destructive" type="submit">Archivar</Button>
          </form>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Badge style={status.color ? { backgroundColor: status.color } : undefined}>{status.name}</Badge>
        {health && <Badge variant="outline">{health.name}</Badge>}
      </div>
      <dl className="grid grid-cols-3 gap-x-8 gap-y-3 text-sm">
        <div><dt className="text-gray-500">Responsable</dt><dd>{responsibleName}</dd></div>
        <div><dt className="text-gray-500">Inicio</dt><dd>{project.startDate ?? '—'}</dd></div>
        <div><dt className="text-gray-500">Compromiso</dt><dd>{project.dueDate ?? '—'}</dd></div>
        <div><dt className="text-gray-500">Horas presupuestadas</dt><dd>{project.budgetedHours ?? '—'}</dd></div>
        <div><dt className="text-gray-500">Tarifa</dt><dd>{project.hourlyRate ? `$${project.hourlyRate}` : 'La del cliente'}</dd></div>
        <div><dt className="text-gray-500">Participantes</dt><dd>{members.length ? members.map((m) => m.name).join(', ') : '—'}</dd></div>
        {project.description && (
          <div className="col-span-3"><dt className="text-gray-500">Descripción</dt><dd className="whitespace-pre-wrap">{project.description}</dd></div>
        )}
      </dl>
      <Separator />
      <section id="subproyectos">
        <h2 className="mb-2 text-lg font-medium">Subproyectos</h2>
        <p className="text-sm text-gray-400">Se habilitan en la Task 8.</p>
      </section>
      <section id="hitos">
        <h2 className="mb-2 text-lg font-medium">Hitos</h2>
        <p className="text-sm text-gray-400">Se habilitan en la Task 9.</p>
      </section>
      <section id="tareas">
        <h2 className="mb-2 text-lg font-medium">Tareas</h2>
        <p className="text-sm text-gray-400">Se habilitan en la Task 11.</p>
      </section>
    </div>
  )
}
```

`src/app/(app)/proyectos/[id]/editar/page.tsx`:

```tsx
import { notFound } from 'next/navigation'
import { db } from '@/db'
import { requireCtx } from '@/lib/session'
import { getProjectDetail } from '@/modules/projects/service'
import { listClients } from '@/modules/clients/service'
import { listActiveUsers } from '@/modules/auth/service'
import { listStatuses } from '@/modules/customization/service'
import { ProjectForm } from '@/modules/projects/project-form'
import { updateProjectAction } from '@/modules/projects/actions'

export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await requireCtx()
  const detail = await getProjectDetail(db, ctx, id)
  if (!detail) notFound()
  const [clients, users, statuses, healths] = await Promise.all([
    listClients(db, ctx),
    listActiveUsers(db, ctx.orgId),
    listStatuses(db, ctx, 'project'),
    listStatuses(db, ctx, 'project_health'),
  ])
  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Editar proyecto</h1>
      <ProjectForm
        action={updateProjectAction.bind(null, id)}
        clients={clients.map((c) => ({ id: c.id, name: c.commercialName }))}
        users={users}
        statuses={statuses}
        healths={healths}
        project={detail.project}
        detail={detail}
      />
    </div>
  )
}
```

- [ ] **Step 4: Listar proyectos del cliente en su detalle**

En `src/app/(app)/clientes/[id]/page.tsx`, reemplazar el párrafo "Los proyectos del cliente se listan aquí a partir de la Task 7." por:

```tsx
<section className="mt-6">
  <h2 className="mb-2 text-lg font-medium">Proyectos</h2>
  {projectRows.length === 0 ? (
    <p className="text-sm text-gray-400">Sin proyectos todavía.</p>
  ) : (
    <ul className="space-y-1 text-sm">
      {projectRows.map(({ project, status }) => (
        <li key={project.id}>
          <Link className="hover:underline" href={`/proyectos/${project.id}`}>{project.name}</Link>
          <span className="ml-2 text-gray-500">({status.name})</span>
        </li>
      ))}
    </ul>
  )}
</section>
```

con `const projectRows = await listProjects(db, ctx, { clientId: client.id })` junto al `getClient` e importando `listProjects`.

- [ ] **Step 5: Verificación y commit**

Run: `npm run lint && npm run typecheck && npm test && npm run build`
Expected: en verde.
Con `npm run dev`: crear un proyecto para el cliente ACME con responsable, estado default, prioridad alta y fechas; verlo en `/proyectos` y en el detalle del cliente; editarlo cambiando el estado a "Activo" y confirmar el badge actualizado.

```bash
git add src/modules/projects/ "src/app/(app)/proyectos/" "src/app/(app)/clientes/"
git commit -m "feat: add projects CRUD pages"
```

---

### Task 8: Subproyectos — service, actions y sección en el detalle del proyecto

**Files:**
- Create: `src/modules/projects/subprojects-service.ts`, `src/modules/projects/subprojects-service.test.ts`, `src/modules/projects/subproject-section.tsx`
- Modify: `src/modules/projects/validation.ts`, `src/modules/projects/actions.ts`, `src/app/(app)/proyectos/[id]/page.tsx`

**Interfaces:**
- Consumes: `subprojects` schema, `getProject` (Task 6), `getDefaultStatus`/`listStatuses` (Task 5), `logActivity`
- Produces (Task 9 y 11 los consumen para selects):
  - `subprojectInputSchema` / `SubprojectInput` — `{ name: string; description?: string; responsibleId?: uuid; statusId?: uuid; startDate?: string; dueDate?: string }`
  - `listSubprojects(db, ctx, projectId): Promise<SubprojectWithStatus[]>` — `SubprojectWithStatus = { subproject: Subproject; status: CustomStatus }`
  - `createSubproject(db, ctx, projectId: string, input: SubprojectInput): Promise<Subproject>` — valida que el proyecto sea de la org; default de estado del catálogo `'project'`
  - `updateSubproject(db, ctx, id, input: SubprojectInput): Promise<Subproject>` (registra `status_changed` si cambió)
  - `archiveSubproject(db, ctx, id): Promise<void>`
  - `Subproject = typeof subprojects.$inferSelect`

- [ ] **Step 1: Agregar el schema Zod a `src/modules/projects/validation.ts`**

Al final del archivo:

```ts
export const subprojectInputSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio').max(200),
  description: z.preprocess(emptyToUndefined, z.string().trim().max(5000).optional()),
  responsibleId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  statusId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  startDate: optionalDate,
  dueDate: optionalDate,
})

export type SubprojectInput = z.infer<typeof subprojectInputSchema>
```

- [ ] **Step 2: Escribir el test que falla — `src/modules/projects/subprojects-service.test.ts`**

```ts
import { beforeAll, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import type { Db } from '@/db'
import { createTestDb } from '@/test/db'
import { seed } from '@/db/seed'
import { organizations } from '@/modules/organization/schema'
import { users } from '@/modules/auth/schema'
import { clients } from '@/modules/clients/schema'
import { subprojects } from './schema'
import type { Ctx } from '@/lib/ctx'
import { DomainError } from '@/lib/errors'
import { createProject } from './service'
import { archiveSubproject, createSubproject, listSubprojects, updateSubproject } from './subprojects-service'
import { listStatuses } from '@/modules/customization/service'

describe('subprojects service', () => {
  let db: Db
  let ctx: Ctx
  let projectId: string

  beforeAll(async () => {
    db = await createTestDb()
    await seed(db, { orgName: 'Org', adminEmail: 'a@x.com', adminPassword: 'x', adminName: 'Ana' })
    const [org] = await db.select().from(organizations)
    const [user] = await db.select().from(users)
    ctx = { orgId: org.id, userId: user.id }
    const [client] = await db.insert(clients).values({ organizationId: org.id, commercialName: 'C' }).returning()
    projectId = (await createProject(db, ctx, { clientId: client.id, name: 'P', responsibleId: user.id, priority: 'medium', memberIds: [] })).id
  })

  it('creates a subproject with the project default status', async () => {
    const sub = await createSubproject(db, ctx, projectId, { name: 'Backend' })
    const rows = await listSubprojects(db, ctx, projectId)
    expect(rows.map((r) => r.subproject.id)).toContain(sub.id)
    expect(rows[0].status.name).toBe('Borrador') // reuses the 'project' catalog default
  })

  it('rejects a project outside the organization', async () => {
    await expect(createSubproject(db, ctx, crypto.randomUUID(), { name: 'X' })).rejects.toThrow(DomainError)
  })

  it('updates and logs status changes', async () => {
    const sub = await createSubproject(db, ctx, projectId, { name: 'Frontend' })
    const activo = (await listStatuses(db, ctx, 'project')).find((s) => s.name === 'Activo')!
    const updated = await updateSubproject(db, ctx, sub.id, { name: 'Frontend', statusId: activo.id })
    expect(updated.statusId).toBe(activo.id)
  })

  it('archives with soft delete', async () => {
    const sub = await createSubproject(db, ctx, projectId, { name: 'Temporal' })
    await archiveSubproject(db, ctx, sub.id)
    expect((await listSubprojects(db, ctx, projectId)).map((r) => r.subproject.id)).not.toContain(sub.id)
    const [raw] = await db.select().from(subprojects).where(eq(subprojects.id, sub.id))
    expect(raw.deletedAt).not.toBeNull()
  })
})
```

- [ ] **Step 3: Correr y verificar que falla**

Run: `npm test`
Expected: FAIL — `./subprojects-service` no existe.

- [ ] **Step 4: Implementar `src/modules/projects/subprojects-service.ts`**

```ts
import { and, asc, eq, isNull } from 'drizzle-orm'
import type { Db } from '@/db'
import type { Ctx } from '@/lib/ctx'
import { DomainError } from '@/lib/errors'
import { logActivity } from '@/modules/collaboration/service'
import { customStatuses } from '@/modules/customization/schema'
import { getDefaultStatus } from '@/modules/customization/service'
import type { CustomStatus } from '@/modules/customization/service'
import { subprojects } from './schema'
import { getProject } from './service'
import type { SubprojectInput } from './validation'

export type Subproject = typeof subprojects.$inferSelect
export interface SubprojectWithStatus { subproject: Subproject; status: CustomStatus }

const scope = (ctx: Ctx, id?: string) =>
  and(eq(subprojects.organizationId, ctx.orgId), isNull(subprojects.deletedAt), ...(id ? [eq(subprojects.id, id)] : []))

const toRow = (input: SubprojectInput) => ({
  name: input.name,
  description: input.description ?? null,
  responsibleId: input.responsibleId ?? null,
  startDate: input.startDate ?? null,
  dueDate: input.dueDate ?? null,
})

export async function listSubprojects(db: Db, ctx: Ctx, projectId: string): Promise<SubprojectWithStatus[]> {
  return db
    .select({ subproject: subprojects, status: customStatuses })
    .from(subprojects)
    .innerJoin(customStatuses, eq(subprojects.statusId, customStatuses.id))
    .where(and(scope(ctx), eq(subprojects.projectId, projectId)))
    .orderBy(asc(subprojects.createdAt))
}

export async function getSubproject(db: Db, ctx: Ctx, id: string): Promise<Subproject | null> {
  const [sub] = await db.select().from(subprojects).where(scope(ctx, id))
  return sub ?? null
}

export async function createSubproject(db: Db, ctx: Ctx, projectId: string, input: SubprojectInput): Promise<Subproject> {
  if (!(await getProject(db, ctx, projectId))) throw new DomainError('Proyecto no encontrado')
  const statusId = input.statusId ?? (await getDefaultStatus(db, ctx, 'project')).id
  const [sub] = await db
    .insert(subprojects)
    .values({ organizationId: ctx.orgId, projectId, statusId, ...toRow(input) })
    .returning()
  await logActivity(db, ctx, { entityType: 'subproject', entityId: sub.id, action: 'created' })
  return sub
}

export async function updateSubproject(db: Db, ctx: Ctx, id: string, input: SubprojectInput): Promise<Subproject> {
  const before = await getSubproject(db, ctx, id)
  if (!before) throw new DomainError('Subproyecto no encontrado')
  const statusId = input.statusId ?? before.statusId
  const [sub] = await db
    .update(subprojects)
    .set({ statusId, ...toRow(input), updatedAt: new Date() })
    .where(scope(ctx, id))
    .returning()
  if (statusId !== before.statusId) {
    await logActivity(db, ctx, { entityType: 'subproject', entityId: id, action: 'status_changed' })
  } else {
    await logActivity(db, ctx, { entityType: 'subproject', entityId: id, action: 'updated' })
  }
  return sub
}

export async function archiveSubproject(db: Db, ctx: Ctx, id: string): Promise<void> {
  if (!(await getSubproject(db, ctx, id))) throw new DomainError('Subproyecto no encontrado')
  await db.update(subprojects).set({ deletedAt: new Date(), updatedAt: new Date() }).where(scope(ctx, id))
  await logActivity(db, ctx, { entityType: 'subproject', entityId: id, action: 'archived' })
}
```

- [ ] **Step 5: Correr los tests y verificar que pasan**

Run: `npm test`
Expected: PASS

- [ ] **Step 6: Actions + sección UI**

Agregar al final de `src/modules/projects/actions.ts`:

```ts
import { subprojectInputSchema } from './validation'
import { archiveSubproject, createSubproject, updateSubproject } from './subprojects-service'

export async function createSubprojectAction(projectId: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ctx = await requireCtx()
  const parsed = subprojectInputSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { ok: false, error: 'Revisa los campos', fieldErrors: fieldErrorsOf(parsed.error) }
  try {
    await createSubproject(db, ctx, projectId, parsed.data)
  } catch (e) {
    if (e instanceof DomainError) return { ok: false, error: e.message }
    throw e
  }
  revalidatePath(`/proyectos/${projectId}`)
  return { ok: true }
}

export async function updateSubprojectAction(id: string, projectId: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ctx = await requireCtx()
  const parsed = subprojectInputSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { ok: false, error: 'Revisa los campos', fieldErrors: fieldErrorsOf(parsed.error) }
  try {
    await updateSubproject(db, ctx, id, parsed.data)
  } catch (e) {
    if (e instanceof DomainError) return { ok: false, error: e.message }
    throw e
  }
  revalidatePath(`/proyectos/${projectId}`)
  return { ok: true }
}

export async function archiveSubprojectAction(id: string, projectId: string): Promise<ActionResult> {
  const ctx = await requireCtx()
  try {
    await archiveSubproject(db, ctx, id)
  } catch (e) {
    if (e instanceof DomainError) return { ok: false, error: e.message }
    throw e
  }
  revalidatePath(`/proyectos/${projectId}`)
  return { ok: true }
}
```

(los imports se agregan junto a los existentes; las actions de subproyectos devuelven `{ ok: true }` en lugar de redirigir porque la UI vive dentro del detalle del proyecto.)

Crear `src/modules/projects/subproject-section.tsx`:

```tsx
'use client'

import { useActionState, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import type { ActionResult } from '@/lib/action-result'
import type { CustomStatus } from '@/modules/customization/service'
import type { SubprojectWithStatus } from './subprojects-service'
import { archiveSubprojectAction, createSubprojectAction, updateSubprojectAction } from './actions'

type Option = { id: string; name: string }

function SubprojectFields({ users, statuses, defaults }: { users: Option[]; statuses: CustomStatus[]; defaults?: SubprojectWithStatus }) {
  const select = 'h-9 rounded border px-2 text-sm'
  return (
    <>
      <Input name="name" placeholder="Nombre" required defaultValue={defaults?.subproject.name} className="max-w-56" />
      <select name="responsibleId" defaultValue={defaults?.subproject.responsibleId ?? ''} className={select}>
        <option value="">Sin responsable</option>
        {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
      </select>
      <select name="statusId" defaultValue={defaults?.subproject.statusId ?? ''} className={select}>
        {!defaults && <option value="">Estado default</option>}
        {statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      <Input name="startDate" type="date" defaultValue={defaults?.subproject.startDate ?? ''} className="w-36" />
      <Input name="dueDate" type="date" defaultValue={defaults?.subproject.dueDate ?? ''} className="w-36" />
    </>
  )
}

function SubprojectRow({ row, projectId, users, statuses }: { row: SubprojectWithStatus; projectId: string; users: Option[]; statuses: CustomStatus[] }) {
  const [editing, setEditing] = useState(false)
  const [state, formAction] = useActionState(
    async (prev: ActionResult | null, formData: FormData) => {
      const res = await updateSubprojectAction(row.subproject.id, projectId, prev, formData)
      if (res.ok) setEditing(false)
      return res
    },
    null,
  )
  const [, startTransition] = useTransition()
  if (editing) {
    return (
      <li className="rounded border bg-white p-2">
        <form action={formAction} className="flex flex-wrap items-center gap-2">
          <SubprojectFields users={users} statuses={statuses} defaults={row} />
          <Button type="submit" size="sm">Guardar</Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancelar</Button>
          {state && !state.ok && <span className="text-sm text-red-600">{state.error}</span>}
        </form>
      </li>
    )
  }
  return (
    <li className="flex items-center gap-3 rounded border bg-white p-2">
      <span className="flex-1 font-medium">{row.subproject.name}</span>
      <Badge style={row.status.color ? { backgroundColor: row.status.color } : undefined}>{row.status.name}</Badge>
      <span className="text-sm text-gray-500">{row.subproject.dueDate ?? 'sin fecha'}</span>
      <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>Editar</Button>
      <Button size="sm" variant="ghost" className="text-red-600"
        onClick={() => startTransition(async () => {
          const res = await archiveSubprojectAction(row.subproject.id, projectId)
          if (!res.ok) toast.error(res.error)
        })}>
        Archivar
      </Button>
    </li>
  )
}

export function SubprojectSection({ projectId, rows, users, statuses }: { projectId: string; rows: SubprojectWithStatus[]; users: Option[]; statuses: CustomStatus[] }) {
  const [state, formAction, pending] = useActionState(createSubprojectAction.bind(null, projectId), null)
  return (
    <div className="space-y-2">
      <ul className="space-y-2">
        {rows.map((r) => <SubprojectRow key={r.subproject.id} row={r} projectId={projectId} users={users} statuses={statuses} />)}
      </ul>
      <form action={formAction} className="flex flex-wrap items-center gap-2 rounded border border-dashed p-2">
        <SubprojectFields users={users} statuses={statuses} />
        <Button type="submit" size="sm" disabled={pending}>Agregar subproyecto</Button>
        {state && !state.ok && <span className="text-sm text-red-600">{state.error}</span>}
      </form>
    </div>
  )
}
```

- [ ] **Step 7: Conectar la sección en `src/app/(app)/proyectos/[id]/page.tsx`**

Reemplazar la sección placeholder de subproyectos por:

```tsx
<section id="subproyectos">
  <h2 className="mb-2 text-lg font-medium">Subproyectos</h2>
  <SubprojectSection projectId={project.id} rows={subprojectRows} users={users} statuses={projectStatuses} />
</section>
```

cargando en el server component:

```tsx
const [subprojectRows, users, projectStatuses] = await Promise.all([
  listSubprojects(db, ctx, project.id),
  listActiveUsers(db, ctx.orgId),
  listStatuses(db, ctx, 'project'),
])
```

con sus imports (`listSubprojects` de `@/modules/projects/subprojects-service`, `listActiveUsers`, `listStatuses`, `SubprojectSection`).

- [ ] **Step 8: Verificación y commit**

Run: `npm run lint && npm run typecheck && npm test && npm run build`
Expected: en verde.
Manual: en un proyecto, agregar subproyecto "Backend", editarlo a estado "Activo", archivarlo.

```bash
git add src/modules/projects/ "src/app/(app)/proyectos/"
git commit -m "feat: add subprojects management inside project detail"
```

---

### Task 9: Hitos — service con orden, actions y sección en el detalle

**Files:**
- Create: `src/modules/projects/milestones-service.ts`, `src/modules/projects/milestones-service.test.ts`, `src/modules/projects/milestone-section.tsx`
- Modify: `src/modules/projects/validation.ts`, `src/modules/projects/actions.ts`, `src/app/(app)/proyectos/[id]/page.tsx`

**Interfaces:**
- Consumes: `milestones` schema, `getProject`, `getSubproject` (Task 8), `getDefaultStatus`/`listStatuses` (`'milestone'`), `logActivity`
- Produces (Task 10/11 los consumen):
  - `milestoneInputSchema` / `MilestoneInput` — `{ name; description?; responsibleId?; statusId?; subprojectId?; targetDate? }`
  - `listMilestones(db, ctx, projectId): Promise<MilestoneWithStatus[]>` ordenados por `sortOrder` — `MilestoneWithStatus = { milestone: Milestone; status: CustomStatus; subprojectName: string | null }`
  - `getMilestone(db, ctx, id): Promise<Milestone | null>`
  - `createMilestone(db, ctx, projectId, input): Promise<Milestone>` — `sortOrder` = max+1 del proyecto; si trae `subprojectId`, el subproyecto debe pertenecer al mismo proyecto
  - `updateMilestone(db, ctx, id, input)`, `archiveMilestone(db, ctx, id)`
  - `moveMilestone(db, ctx, id, direction: 'up' | 'down')` (intercambia `sortOrder` con el vecino del mismo proyecto)
  - `Milestone = typeof milestones.$inferSelect`

- [ ] **Step 1: Agregar el schema Zod a `src/modules/projects/validation.ts`**

```ts
export const milestoneInputSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio').max(200),
  description: z.preprocess(emptyToUndefined, z.string().trim().max(5000).optional()),
  responsibleId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  statusId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  subprojectId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  targetDate: optionalDate,
})

export type MilestoneInput = z.infer<typeof milestoneInputSchema>
```

- [ ] **Step 2: Escribir el test que falla — `src/modules/projects/milestones-service.test.ts`**

```ts
import { beforeAll, describe, expect, it } from 'vitest'
import type { Db } from '@/db'
import { createTestDb } from '@/test/db'
import { seed } from '@/db/seed'
import { organizations } from '@/modules/organization/schema'
import { users } from '@/modules/auth/schema'
import { clients } from '@/modules/clients/schema'
import type { Ctx } from '@/lib/ctx'
import { DomainError } from '@/lib/errors'
import { createProject } from './service'
import { createSubproject } from './subprojects-service'
import { archiveMilestone, createMilestone, listMilestones, moveMilestone, updateMilestone } from './milestones-service'

describe('milestones service', () => {
  let db: Db
  let ctx: Ctx
  let projectId: string
  let otherProjectId: string
  let subId: string

  beforeAll(async () => {
    db = await createTestDb()
    await seed(db, { orgName: 'Org', adminEmail: 'a@x.com', adminPassword: 'x', adminName: 'Ana' })
    const [org] = await db.select().from(organizations)
    const [user] = await db.select().from(users)
    ctx = { orgId: org.id, userId: user.id }
    const [client] = await db.insert(clients).values({ organizationId: org.id, commercialName: 'C' }).returning()
    const base = { clientId: client.id, responsibleId: user.id, priority: 'medium' as const, memberIds: [] }
    projectId = (await createProject(db, ctx, { ...base, name: 'P1' })).id
    otherProjectId = (await createProject(db, ctx, { ...base, name: 'P2' })).id
    subId = (await createSubproject(db, ctx, projectId, { name: 'Sub' })).id
  })

  it('creates milestones with incremental sortOrder and default status', async () => {
    const m1 = await createMilestone(db, ctx, projectId, { name: 'Entrega 1' })
    const m2 = await createMilestone(db, ctx, projectId, { name: 'Entrega 2' })
    expect(m2.sortOrder).toBe(m1.sortOrder + 1)
    const rows = await listMilestones(db, ctx, projectId)
    expect(rows.map((r) => r.milestone.name)).toEqual(['Entrega 1', 'Entrega 2'])
    expect(rows[0].status.name).toBe('Pendiente')
  })

  it('links to a subproject of the same project only', async () => {
    const linked = await createMilestone(db, ctx, projectId, { name: 'Con sub', subprojectId: subId })
    expect(linked.subprojectId).toBe(subId)
    await expect(createMilestone(db, ctx, otherProjectId, { name: 'Cruzado', subprojectId: subId })).rejects.toThrow(DomainError)
  })

  it('reorders milestones within the project', async () => {
    const before = await listMilestones(db, ctx, projectId)
    await moveMilestone(db, ctx, before[1].milestone.id, 'up')
    const after = await listMilestones(db, ctx, projectId)
    expect(after[0].milestone.id).toBe(before[1].milestone.id)
  })

  it('updates and archives', async () => {
    const m = await createMilestone(db, ctx, projectId, { name: 'Editable' })
    const updated = await updateMilestone(db, ctx, m.id, { name: 'Editado', targetDate: '2026-08-31' })
    expect(updated.name).toBe('Editado')
    expect(updated.targetDate).toBe('2026-08-31')
    await archiveMilestone(db, ctx, m.id)
    expect((await listMilestones(db, ctx, projectId)).map((r) => r.milestone.id)).not.toContain(m.id)
  })
})
```

- [ ] **Step 3: Correr y verificar que falla**

Run: `npm test`
Expected: FAIL — `./milestones-service` no existe.

- [ ] **Step 4: Implementar `src/modules/projects/milestones-service.ts`**

```ts
import { and, asc, eq, isNull, sql } from 'drizzle-orm'
import type { Db } from '@/db'
import type { Ctx } from '@/lib/ctx'
import { DomainError } from '@/lib/errors'
import { logActivity } from '@/modules/collaboration/service'
import { customStatuses } from '@/modules/customization/schema'
import { getDefaultStatus } from '@/modules/customization/service'
import type { CustomStatus } from '@/modules/customization/service'
import { milestones, subprojects } from './schema'
import { getProject } from './service'
import { getSubproject } from './subprojects-service'
import type { MilestoneInput } from './validation'

export type Milestone = typeof milestones.$inferSelect
export interface MilestoneWithStatus { milestone: Milestone; status: CustomStatus; subprojectName: string | null }

const scope = (ctx: Ctx, id?: string) =>
  and(eq(milestones.organizationId, ctx.orgId), isNull(milestones.deletedAt), ...(id ? [eq(milestones.id, id)] : []))

const toRow = (input: MilestoneInput) => ({
  name: input.name,
  description: input.description ?? null,
  responsibleId: input.responsibleId ?? null,
  subprojectId: input.subprojectId ?? null,
  targetDate: input.targetDate ?? null,
})

async function assertSubprojectInProject(db: Db, ctx: Ctx, projectId: string, subprojectId?: string): Promise<void> {
  if (!subprojectId) return
  const sub = await getSubproject(db, ctx, subprojectId)
  if (!sub || sub.projectId !== projectId) throw new DomainError('El subproyecto no pertenece a este proyecto')
}

export async function listMilestones(db: Db, ctx: Ctx, projectId: string): Promise<MilestoneWithStatus[]> {
  return db
    .select({ milestone: milestones, status: customStatuses, subprojectName: subprojects.name })
    .from(milestones)
    .innerJoin(customStatuses, eq(milestones.statusId, customStatuses.id))
    .leftJoin(subprojects, eq(milestones.subprojectId, subprojects.id))
    .where(and(scope(ctx), eq(milestones.projectId, projectId)))
    .orderBy(asc(milestones.sortOrder))
}

export async function getMilestone(db: Db, ctx: Ctx, id: string): Promise<Milestone | null> {
  const [m] = await db.select().from(milestones).where(scope(ctx, id))
  return m ?? null
}

export async function createMilestone(db: Db, ctx: Ctx, projectId: string, input: MilestoneInput): Promise<Milestone> {
  if (!(await getProject(db, ctx, projectId))) throw new DomainError('Proyecto no encontrado')
  await assertSubprojectInProject(db, ctx, projectId, input.subprojectId)
  const statusId = input.statusId ?? (await getDefaultStatus(db, ctx, 'milestone')).id
  const [{ max }] = await db
    .select({ max: sql<number>`coalesce(max(${milestones.sortOrder}), -1)::int` })
    .from(milestones)
    .where(and(scope(ctx), eq(milestones.projectId, projectId)))
  const [m] = await db
    .insert(milestones)
    .values({ organizationId: ctx.orgId, projectId, statusId, sortOrder: max + 1, ...toRow(input) })
    .returning()
  await logActivity(db, ctx, { entityType: 'milestone', entityId: m.id, action: 'created' })
  return m
}

export async function updateMilestone(db: Db, ctx: Ctx, id: string, input: MilestoneInput): Promise<Milestone> {
  const before = await getMilestone(db, ctx, id)
  if (!before) throw new DomainError('Hito no encontrado')
  await assertSubprojectInProject(db, ctx, before.projectId, input.subprojectId)
  const statusId = input.statusId ?? before.statusId
  const [m] = await db
    .update(milestones)
    .set({ statusId, ...toRow(input), updatedAt: new Date() })
    .where(scope(ctx, id))
    .returning()
  await logActivity(db, ctx, {
    entityType: 'milestone',
    entityId: id,
    action: statusId !== before.statusId ? 'status_changed' : 'updated',
  })
  return m
}

export async function archiveMilestone(db: Db, ctx: Ctx, id: string): Promise<void> {
  if (!(await getMilestone(db, ctx, id))) throw new DomainError('Hito no encontrado')
  await db.update(milestones).set({ deletedAt: new Date(), updatedAt: new Date() }).where(scope(ctx, id))
  await logActivity(db, ctx, { entityType: 'milestone', entityId: id, action: 'archived' })
}

export async function moveMilestone(db: Db, ctx: Ctx, id: string, direction: 'up' | 'down'): Promise<void> {
  const m = await getMilestone(db, ctx, id)
  if (!m) throw new DomainError('Hito no encontrado')
  const siblings = await listMilestones(db, ctx, m.projectId)
  const idx = siblings.findIndex((r) => r.milestone.id === id)
  const swapWith = direction === 'up' ? siblings[idx - 1]?.milestone : siblings[idx + 1]?.milestone
  if (!swapWith) return
  await db.update(milestones).set({ sortOrder: swapWith.sortOrder, updatedAt: new Date() }).where(eq(milestones.id, m.id))
  await db.update(milestones).set({ sortOrder: m.sortOrder, updatedAt: new Date() }).where(eq(milestones.id, swapWith.id))
}
```

- [ ] **Step 5: Correr los tests y verificar que pasan**

Run: `npm test`
Expected: PASS

- [ ] **Step 6: Actions y sección UI de hitos**

Agregar a `src/modules/projects/actions.ts` (mismo patrón que subproyectos):

```ts
import { milestoneInputSchema } from './validation'
import { archiveMilestone, createMilestone, moveMilestone, updateMilestone } from './milestones-service'

export async function createMilestoneAction(projectId: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ctx = await requireCtx()
  const parsed = milestoneInputSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { ok: false, error: 'Revisa los campos', fieldErrors: fieldErrorsOf(parsed.error) }
  try {
    await createMilestone(db, ctx, projectId, parsed.data)
  } catch (e) {
    if (e instanceof DomainError) return { ok: false, error: e.message }
    throw e
  }
  revalidatePath(`/proyectos/${projectId}`)
  return { ok: true }
}

export async function updateMilestoneAction(id: string, projectId: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ctx = await requireCtx()
  const parsed = milestoneInputSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { ok: false, error: 'Revisa los campos', fieldErrors: fieldErrorsOf(parsed.error) }
  try {
    await updateMilestone(db, ctx, id, parsed.data)
  } catch (e) {
    if (e instanceof DomainError) return { ok: false, error: e.message }
    throw e
  }
  revalidatePath(`/proyectos/${projectId}`)
  return { ok: true }
}

export async function archiveMilestoneAction(id: string, projectId: string): Promise<ActionResult> {
  const ctx = await requireCtx()
  try {
    await archiveMilestone(db, ctx, id)
  } catch (e) {
    if (e instanceof DomainError) return { ok: false, error: e.message }
    throw e
  }
  revalidatePath(`/proyectos/${projectId}`)
  return { ok: true }
}

export async function moveMilestoneAction(id: string, projectId: string, direction: 'up' | 'down'): Promise<ActionResult> {
  const ctx = await requireCtx()
  await moveMilestone(db, ctx, id, direction)
  revalidatePath(`/proyectos/${projectId}`)
  return { ok: true }
}
```

Crear `src/modules/projects/milestone-section.tsx` (misma estructura que `subproject-section.tsx`, con estos campos y botones ↑/↓):

```tsx
'use client'

import { useActionState, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import type { ActionResult } from '@/lib/action-result'
import type { CustomStatus } from '@/modules/customization/service'
import type { MilestoneWithStatus } from './milestones-service'
import { archiveMilestoneAction, createMilestoneAction, moveMilestoneAction, updateMilestoneAction } from './actions'

type Option = { id: string; name: string }

function MilestoneFields({ users, statuses, subprojectOptions, defaults }: {
  users: Option[]; statuses: CustomStatus[]; subprojectOptions: Option[]; defaults?: MilestoneWithStatus
}) {
  const select = 'h-9 rounded border px-2 text-sm'
  return (
    <>
      <Input name="name" placeholder="Nombre del hito" required defaultValue={defaults?.milestone.name} className="max-w-56" />
      <select name="subprojectId" defaultValue={defaults?.milestone.subprojectId ?? ''} className={select}>
        <option value="">Directo al proyecto</option>
        {subprojectOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      <select name="responsibleId" defaultValue={defaults?.milestone.responsibleId ?? ''} className={select}>
        <option value="">Sin responsable</option>
        {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
      </select>
      <select name="statusId" defaultValue={defaults?.milestone.statusId ?? ''} className={select}>
        {!defaults && <option value="">Estado default</option>}
        {statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      <Input name="targetDate" type="date" defaultValue={defaults?.milestone.targetDate ?? ''} className="w-36" />
    </>
  )
}

function MilestoneRow({ row, projectId, users, statuses, subprojectOptions, first, last }: {
  row: MilestoneWithStatus; projectId: string; users: Option[]; statuses: CustomStatus[]; subprojectOptions: Option[]; first: boolean; last: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [state, formAction] = useActionState(
    async (prev: ActionResult | null, formData: FormData) => {
      const res = await updateMilestoneAction(row.milestone.id, projectId, prev, formData)
      if (res.ok) setEditing(false)
      return res
    },
    null,
  )
  const [, startTransition] = useTransition()
  const act = (fn: () => Promise<ActionResult>) =>
    startTransition(async () => {
      const res = await fn()
      if (!res.ok) toast.error(res.error)
    })
  if (editing) {
    return (
      <li className="rounded border bg-white p-2">
        <form action={formAction} className="flex flex-wrap items-center gap-2">
          <MilestoneFields users={users} statuses={statuses} subprojectOptions={subprojectOptions} defaults={row} />
          <Button type="submit" size="sm">Guardar</Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancelar</Button>
          {state && !state.ok && <span className="text-sm text-red-600">{state.error}</span>}
        </form>
      </li>
    )
  }
  return (
    <li className="flex items-center gap-3 rounded border bg-white p-2">
      <span className="flex-1 font-medium">{row.milestone.name}</span>
      {row.subprojectName && <span className="text-sm text-gray-500">{row.subprojectName}</span>}
      <Badge style={row.status.color ? { backgroundColor: row.status.color } : undefined}>{row.status.name}</Badge>
      <span className="text-sm text-gray-500">{row.milestone.targetDate ?? 'sin fecha'}</span>
      <Button size="sm" variant="ghost" disabled={first} onClick={() => act(() => moveMilestoneAction(row.milestone.id, projectId, 'up'))}>↑</Button>
      <Button size="sm" variant="ghost" disabled={last} onClick={() => act(() => moveMilestoneAction(row.milestone.id, projectId, 'down'))}>↓</Button>
      <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>Editar</Button>
      <Button size="sm" variant="ghost" className="text-red-600" onClick={() => act(() => archiveMilestoneAction(row.milestone.id, projectId))}>Archivar</Button>
    </li>
  )
}

export function MilestoneSection({ projectId, rows, users, statuses, subprojectOptions }: {
  projectId: string; rows: MilestoneWithStatus[]; users: Option[]; statuses: CustomStatus[]; subprojectOptions: Option[]
}) {
  const [state, formAction, pending] = useActionState(createMilestoneAction.bind(null, projectId), null)
  return (
    <div className="space-y-2">
      <ul className="space-y-2">
        {rows.map((r, i) => (
          <MilestoneRow key={r.milestone.id} row={r} projectId={projectId} users={users} statuses={statuses}
            subprojectOptions={subprojectOptions} first={i === 0} last={i === rows.length - 1} />
        ))}
      </ul>
      <form action={formAction} className="flex flex-wrap items-center gap-2 rounded border border-dashed p-2">
        <MilestoneFields users={users} statuses={statuses} subprojectOptions={subprojectOptions} />
        <Button type="submit" size="sm" disabled={pending}>Agregar hito</Button>
        {state && !state.ok && <span className="text-sm text-red-600">{state.error}</span>}
      </form>
    </div>
  )
}
```

- [ ] **Step 7: Conectar en el detalle del proyecto**

En `src/app/(app)/proyectos/[id]/page.tsx`, reemplazar el placeholder de hitos por:

```tsx
<section id="hitos">
  <h2 className="mb-2 text-lg font-medium">Hitos</h2>
  <MilestoneSection projectId={project.id} rows={milestoneRows} users={users}
    statuses={milestoneStatuses}
    subprojectOptions={subprojectRows.map((r) => ({ id: r.subproject.id, name: r.subproject.name }))} />
</section>
```

agregando a las cargas: `listMilestones(db, ctx, project.id)` → `milestoneRows` y `listStatuses(db, ctx, 'milestone')` → `milestoneStatuses`.

- [ ] **Step 8: Verificación y commit**

Run: `npm run lint && npm run typecheck && npm test && npm run build`
Expected: en verde.
Manual: crear dos hitos, uno ligado a un subproyecto; reordenarlos con ↑/↓; editar la fecha objetivo.

```bash
git add src/modules/projects/ "src/app/(app)/proyectos/"
git commit -m "feat: add milestones management with ordering"
```

---

### Task 10: Tareas — service con multi-responsable y filtros

**Files:**
- Create: `src/modules/tasks/validation.ts`, `src/modules/tasks/service.ts`, `src/modules/tasks/service.test.ts`

**Interfaces:**
- Consumes: `tasks`/`taskAssignees` schema, `getMilestone` (Task 9), `getDefaultStatus`/`listStatuses` (`'task'`), `logActivity`, `users`
- Produces (Tasks 11–12 y la sección de tareas del proyecto):
  - `taskInputSchema` / `TaskInput` — `{ milestoneId: uuid; name; description?; statusId?; priority ('low'|'medium'|'high'|'urgent', default 'medium'); startDate?; dueDate?; estimatedHours?: number; isBillableDefault: boolean; assigneeIds: uuid[] (mín. 1, 'Selecciona al menos un responsable') }`. **`projectId` y `subprojectId` NO vienen del formulario: se derivan del hito** (consistencia de jerarquía).
  - `TaskFilters = { projectId?: string; milestoneId?: string; assigneeId?: string; statusId?: string; overdueOnly?: boolean; dueInDays?: number }`
  - `listTasks(db, ctx, filters?: TaskFilters): Promise<TaskListItem[]>` — `TaskListItem = { task: Task; status: CustomStatus; projectName: string; milestoneName: string; assignees: { id: string; name: string }[] }`; "atrasada" = `dueDate < hoy` y categoría ∉ {done, cancelled}
  - `getTask(db, ctx, id): Promise<Task | null>`; `getTaskAssigneeIds(db, ctx, id): Promise<string[]>`
  - `createTask(db, ctx, input: TaskInput): Promise<Task>`; `updateTask(db, ctx, id, input: TaskInput): Promise<Task>`
  - `changeTaskStatus(db, ctx, id, statusId): Promise<void>` (valida catálogo `'task'` de la org; registra `status_changed` con nombres antes/después)
  - `archiveTask(db, ctx, id): Promise<void>` (borra filas de `task_assignees`)
  - `Task = typeof tasks.$inferSelect`

- [ ] **Step 1: Crear `src/modules/tasks/validation.ts`**

```ts
import { z } from 'zod'
import { emptyToUndefined } from '@/lib/zod-utils'

const optionalDate = z.preprocess(emptyToUndefined, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida').optional())

export const taskInputSchema = z.object({
  milestoneId: z.string().uuid('Selecciona un hito'),
  name: z.string().trim().min(1, 'El nombre es obligatorio').max(200),
  description: z.preprocess(emptyToUndefined, z.string().trim().max(5000).optional()),
  statusId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  startDate: optionalDate,
  dueDate: optionalDate,
  estimatedHours: z.preprocess(
    emptyToUndefined,
    z.coerce.number({ message: 'Debe ser un número' }).positive('Debe ser mayor a 0').optional(),
  ),
  isBillableDefault: z.preprocess((v) => v === 'on' || v === true, z.boolean()).default(false),
  assigneeIds: z.array(z.string().uuid()).min(1, 'Selecciona al menos un responsable'),
})

export type TaskInput = z.infer<typeof taskInputSchema>
```

- [ ] **Step 2: Escribir el test que falla — `src/modules/tasks/service.test.ts`**

```ts
import { beforeAll, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import type { Db } from '@/db'
import { createTestDb } from '@/test/db'
import { seed } from '@/db/seed'
import { organizations } from '@/modules/organization/schema'
import { users } from '@/modules/auth/schema'
import { clients } from '@/modules/clients/schema'
import { activityLog } from '@/modules/collaboration/schema'
import { taskAssignees } from './schema'
import type { Ctx } from '@/lib/ctx'
import { DomainError } from '@/lib/errors'
import { createProject } from '@/modules/projects/service'
import { createSubproject } from '@/modules/projects/subprojects-service'
import { createMilestone } from '@/modules/projects/milestones-service'
import { listStatuses } from '@/modules/customization/service'
import { archiveTask, changeTaskStatus, createTask, getTaskAssigneeIds, listTasks, updateTask } from './service'

describe('tasks service', () => {
  let db: Db
  let ctx: Ctx
  let userA: string
  let userB: string
  let projectId: string
  let milestoneId: string
  let subMilestoneId: string
  let subId: string

  beforeAll(async () => {
    db = await createTestDb()
    await seed(db, { orgName: 'Org', adminEmail: 'a@x.com', adminPassword: 'x', adminName: 'Ana' })
    const [org] = await db.select().from(organizations)
    const [admin] = await db.select().from(users)
    userA = admin.id
    const [b] = await db.insert(users).values({ organizationId: org.id, name: 'Beto', email: 'b@x.com', passwordHash: 'x' }).returning()
    userB = b.id
    ctx = { orgId: org.id, userId: userA }
    const [client] = await db.insert(clients).values({ organizationId: org.id, commercialName: 'C' }).returning()
    projectId = (await createProject(db, ctx, { clientId: client.id, name: 'P', responsibleId: userA, priority: 'medium', memberIds: [] })).id
    milestoneId = (await createMilestone(db, ctx, projectId, { name: 'M directo' })).id
    subId = (await createSubproject(db, ctx, projectId, { name: 'Sub' })).id
    subMilestoneId = (await createMilestone(db, ctx, projectId, { name: 'M en sub', subprojectId: subId })).id
  })

  const base = () => ({ milestoneId, name: 'T', priority: 'medium' as const, isBillableDefault: true, assigneeIds: [userA] })

  it('creates a task with several assignees and logs it (def-§7.5)', async () => {
    const task = await createTask(db, ctx, { ...base(), name: 'Doble', assigneeIds: [userA, userB] })
    expect(await getTaskAssigneeIds(db, ctx, task.id)).toEqual(expect.arrayContaining([userA, userB]))
    const logs = await db.select().from(activityLog).where(eq(activityLog.entityId, task.id))
    expect(logs.map((l) => l.action)).toContain('created')
  })

  it('derives projectId and subprojectId from the milestone', async () => {
    const direct = await createTask(db, ctx, { ...base(), name: 'Directa' })
    expect(direct.projectId).toBe(projectId)
    expect(direct.subprojectId).toBeNull()
    const inSub = await createTask(db, ctx, { ...base(), milestoneId: subMilestoneId, name: 'En sub' })
    expect(inSub.subprojectId).toBe(subId)
  })

  it('rejects a milestone outside the organization', async () => {
    await expect(createTask(db, ctx, { ...base(), milestoneId: crypto.randomUUID() })).rejects.toThrow(DomainError)
  })

  it('filters by assignee and flags overdue by category', async () => {
    const done = (await listStatuses(db, ctx, 'task')).find((s) => s.name === 'Completada')!
    await createTask(db, ctx, { ...base(), name: 'Vencida abierta', dueDate: '2026-01-01', assigneeIds: [userB] })
    const finished = await createTask(db, ctx, { ...base(), name: 'Vencida cerrada', dueDate: '2026-01-01' })
    await changeTaskStatus(db, ctx, finished.id, done.id)

    const ofB = await listTasks(db, ctx, { assigneeId: userB })
    expect(ofB.map((t) => t.task.name)).toContain('Vencida abierta')
    expect(ofB.map((t) => t.task.name)).not.toContain('Directa')

    const overdue = (await listTasks(db, ctx, { overdueOnly: true })).map((t) => t.task.name)
    expect(overdue).toContain('Vencida abierta')
    expect(overdue).not.toContain('Vencida cerrada') // done no cuenta como atrasada
  })

  it('changeTaskStatus logs before/after names and validates the catalog', async () => {
    const task = await createTask(db, ctx, { ...base(), name: 'Flujo' })
    const progress = (await listStatuses(db, ctx, 'task')).find((s) => s.name === 'En progreso')!
    await changeTaskStatus(db, ctx, task.id, progress.id)
    const logs = await db.select().from(activityLog).where(eq(activityLog.entityId, task.id))
    const change = logs.find((l) => l.action === 'status_changed')
    expect(change?.changes).toEqual({ before: { status: 'Pendiente' }, after: { status: 'En progreso' } })
    const projectStatus = (await listStatuses(db, ctx, 'project'))[0]
    await expect(changeTaskStatus(db, ctx, task.id, projectStatus.id)).rejects.toThrow(DomainError)
  })

  it('updateTask replaces assignees; archiveTask clears them', async () => {
    const task = await createTask(db, ctx, { ...base(), name: 'Cambiante', assigneeIds: [userA] })
    await updateTask(db, ctx, task.id, { ...base(), name: 'Cambiante', assigneeIds: [userB] })
    expect(await getTaskAssigneeIds(db, ctx, task.id)).toEqual([userB])
    await archiveTask(db, ctx, task.id)
    expect((await listTasks(db, ctx, { projectId })).map((t) => t.task.id)).not.toContain(task.id)
    expect(await db.select().from(taskAssignees).where(eq(taskAssignees.taskId, task.id))).toHaveLength(0)
  })
})
```

- [ ] **Step 3: Correr y verificar que falla**

Run: `npm test`
Expected: FAIL — `./service` no existe en tasks.

- [ ] **Step 4: Implementar `src/modules/tasks/service.ts`**

```ts
import { and, asc, eq, exists, inArray, isNull, lt, lte, notInArray, sql } from 'drizzle-orm'
import type { Db } from '@/db'
import type { Ctx } from '@/lib/ctx'
import { DomainError } from '@/lib/errors'
import { logActivity } from '@/modules/collaboration/service'
import { users } from '@/modules/auth/schema'
import { customStatuses } from '@/modules/customization/schema'
import { getDefaultStatus } from '@/modules/customization/service'
import type { CustomStatus } from '@/modules/customization/service'
import { milestones, projects } from '@/modules/projects/schema'
import { getMilestone } from '@/modules/projects/milestones-service'
import { taskAssignees, tasks } from './schema'
import type { TaskInput } from './validation'

export type Task = typeof tasks.$inferSelect
export interface TaskListItem {
  task: Task
  status: CustomStatus
  projectName: string
  milestoneName: string
  assignees: { id: string; name: string }[]
}
export interface TaskFilters {
  projectId?: string
  milestoneId?: string
  assigneeId?: string
  statusId?: string
  overdueOnly?: boolean
  dueInDays?: number
}

const scope = (ctx: Ctx, id?: string) =>
  and(eq(tasks.organizationId, ctx.orgId), isNull(tasks.deletedAt), ...(id ? [eq(tasks.id, id)] : []))

const todayIso = () => new Date().toISOString().slice(0, 10)
const plusDaysIso = (days: number) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10)

const toRow = (input: TaskInput) => ({
  name: input.name,
  description: input.description ?? null,
  priority: input.priority,
  startDate: input.startDate ?? null,
  dueDate: input.dueDate ?? null,
  estimatedHours: input.estimatedHours != null ? String(input.estimatedHours) : null,
  isBillableDefault: input.isBillableDefault,
})

async function assertAssignees(db: Db, ctx: Ctx, assigneeIds: string[]): Promise<void> {
  const found = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.organizationId, ctx.orgId), inArray(users.id, assigneeIds)))
  if (found.length !== new Set(assigneeIds).size) throw new DomainError('Responsable no encontrado')
}

async function assertTaskStatus(db: Db, ctx: Ctx, statusId: string): Promise<CustomStatus> {
  const [status] = await db
    .select()
    .from(customStatuses)
    .where(and(eq(customStatuses.organizationId, ctx.orgId), eq(customStatuses.id, statusId), eq(customStatuses.entityType, 'task')))
  if (!status) throw new DomainError('Estado no válido para tareas')
  return status
}

async function replaceAssignees(db: Db, taskId: string, assigneeIds: string[]): Promise<void> {
  await db.delete(taskAssignees).where(eq(taskAssignees.taskId, taskId))
  await db.insert(taskAssignees).values(assigneeIds.map((userId) => ({ taskId, userId })))
}

export async function createTask(db: Db, ctx: Ctx, input: TaskInput): Promise<Task> {
  const milestone = await getMilestone(db, ctx, input.milestoneId)
  if (!milestone) throw new DomainError('Hito no encontrado')
  await assertAssignees(db, ctx, input.assigneeIds)
  const statusId = input.statusId ? (await assertTaskStatus(db, ctx, input.statusId)).id : (await getDefaultStatus(db, ctx, 'task')).id
  const [task] = await db
    .insert(tasks)
    .values({
      organizationId: ctx.orgId,
      projectId: milestone.projectId,
      subprojectId: milestone.subprojectId,
      milestoneId: milestone.id,
      statusId,
      ...toRow(input),
    })
    .returning()
  await replaceAssignees(db, task.id, input.assigneeIds)
  await logActivity(db, ctx, { entityType: 'task', entityId: task.id, action: 'created' })
  return task
}

export async function getTask(db: Db, ctx: Ctx, id: string): Promise<Task | null> {
  const [task] = await db.select().from(tasks).where(scope(ctx, id))
  return task ?? null
}

export async function getTaskAssigneeIds(db: Db, ctx: Ctx, id: string): Promise<string[]> {
  if (!(await getTask(db, ctx, id))) return []
  const rows = await db.select({ userId: taskAssignees.userId }).from(taskAssignees).where(eq(taskAssignees.taskId, id))
  return rows.map((r) => r.userId)
}

export async function listTasks(db: Db, ctx: Ctx, filters: TaskFilters = {}): Promise<TaskListItem[]> {
  const conditions = [scope(ctx)]
  if (filters.projectId) conditions.push(eq(tasks.projectId, filters.projectId))
  if (filters.milestoneId) conditions.push(eq(tasks.milestoneId, filters.milestoneId))
  if (filters.statusId) conditions.push(eq(tasks.statusId, filters.statusId))
  if (filters.assigneeId) {
    conditions.push(
      exists(
        db.select({ one: sql`1` }).from(taskAssignees)
          .where(and(eq(taskAssignees.taskId, tasks.id), eq(taskAssignees.userId, filters.assigneeId))),
      ),
    )
  }
  const openOnly = notInArray(customStatuses.category, ['done', 'cancelled'])
  if (filters.overdueOnly) conditions.push(lt(tasks.dueDate, todayIso()), openOnly)
  if (filters.dueInDays != null) conditions.push(lte(tasks.dueDate, plusDaysIso(filters.dueInDays)), openOnly)

  const rows = await db
    .select({ task: tasks, status: customStatuses, projectName: projects.name, milestoneName: milestones.name })
    .from(tasks)
    .innerJoin(customStatuses, eq(tasks.statusId, customStatuses.id))
    .innerJoin(projects, eq(tasks.projectId, projects.id))
    .innerJoin(milestones, eq(tasks.milestoneId, milestones.id))
    .where(and(...conditions))
    .orderBy(asc(tasks.dueDate), asc(tasks.createdAt))

  const ids = rows.map((r) => r.task.id)
  const assigneeRows = ids.length
    ? await db
        .select({ taskId: taskAssignees.taskId, id: users.id, name: users.name })
        .from(taskAssignees)
        .innerJoin(users, eq(taskAssignees.userId, users.id))
        .where(inArray(taskAssignees.taskId, ids))
    : []
  return rows.map((r) => ({
    ...r,
    assignees: assigneeRows.filter((a) => a.taskId === r.task.id).map(({ id, name }) => ({ id, name })),
  }))
}

export async function updateTask(db: Db, ctx: Ctx, id: string, input: TaskInput): Promise<Task> {
  const before = await getTask(db, ctx, id)
  if (!before) throw new DomainError('Tarea no encontrada')
  const milestone = await getMilestone(db, ctx, input.milestoneId)
  if (!milestone) throw new DomainError('Hito no encontrado')
  await assertAssignees(db, ctx, input.assigneeIds)
  const statusId = input.statusId ? (await assertTaskStatus(db, ctx, input.statusId)).id : before.statusId
  const [task] = await db
    .update(tasks)
    .set({
      projectId: milestone.projectId,
      subprojectId: milestone.subprojectId,
      milestoneId: milestone.id,
      statusId,
      ...toRow(input),
      updatedAt: new Date(),
    })
    .where(scope(ctx, id))
    .returning()
  await replaceAssignees(db, id, input.assigneeIds)
  if (statusId !== before.statusId) {
    const [prev] = await db.select().from(customStatuses).where(eq(customStatuses.id, before.statusId))
    const [next] = await db.select().from(customStatuses).where(eq(customStatuses.id, statusId))
    await logActivity(db, ctx, {
      entityType: 'task', entityId: id, action: 'status_changed',
      changes: { before: { status: prev.name }, after: { status: next.name } },
    })
  } else {
    await logActivity(db, ctx, { entityType: 'task', entityId: id, action: 'updated' })
  }
  return task
}

export async function changeTaskStatus(db: Db, ctx: Ctx, id: string, statusId: string): Promise<void> {
  const task = await getTask(db, ctx, id)
  if (!task) throw new DomainError('Tarea no encontrada')
  if (task.statusId === statusId) return
  const next = await assertTaskStatus(db, ctx, statusId)
  const [prev] = await db.select().from(customStatuses).where(eq(customStatuses.id, task.statusId))
  await db.update(tasks).set({ statusId, updatedAt: new Date() }).where(scope(ctx, id))
  await logActivity(db, ctx, {
    entityType: 'task', entityId: id, action: 'status_changed',
    changes: { before: { status: prev.name }, after: { status: next.name } },
  })
}

export async function archiveTask(db: Db, ctx: Ctx, id: string): Promise<void> {
  if (!(await getTask(db, ctx, id))) throw new DomainError('Tarea no encontrada')
  await db.update(tasks).set({ deletedAt: new Date(), updatedAt: new Date() }).where(scope(ctx, id))
  await db.delete(taskAssignees).where(eq(taskAssignees.taskId, id))
  await logActivity(db, ctx, { entityType: 'task', entityId: id, action: 'archived' })
}
```

- [ ] **Step 5: Correr los tests y verificar que pasan**

Run: `npm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/modules/tasks/
git commit -m "feat: add tasks service with multi-assignee and filters"
```

---

### Task 11: Tareas — UI: lista con filtros y presets, formulario y sección en proyecto

**Files:**
- Create: `src/modules/tasks/actions.ts`, `src/modules/tasks/task-form.tsx`, `src/modules/tasks/task-filters.tsx`
- Create: `src/app/(app)/tareas/page.tsx`, `src/app/(app)/tareas/nueva/page.tsx`, `src/app/(app)/tareas/[id]/editar/page.tsx`
- Modify: `src/app/(app)/proyectos/[id]/page.tsx` (sección de tareas)

**Interfaces:**
- Consumes: Task 10 completo, `listMilestones` (para el select agrupado), `listActiveUsers`, `listStatuses('task')`, `listProjects`, `Field` (Task 4)
- Produces:
  - `createTaskAction(prev, formData)`, `updateTaskAction(id, prev, formData)`, `archiveTaskAction(id)`, `changeTaskStatusAction(id, statusId): Promise<ActionResult>` (esta última la reutiliza el Kanban, Task 12)
  - `<TaskForm action milestoneOptions users statuses task assigneeIds />` — `milestoneOptions: { id: string; label: string }[]` con label `"Proyecto — Hito"`
  - `/tareas` acepta query params: `proyecto`, `responsable`, `estado`, `preset` (`mias` | `atrasadas` | `proximas`)

- [ ] **Step 1: Crear `src/modules/tasks/actions.ts`**

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '@/db'
import { requireCtx } from '@/lib/session'
import { DomainError } from '@/lib/errors'
import type { ActionResult } from '@/lib/action-result'
import { fieldErrorsOf } from '@/lib/zod-utils'
import { taskInputSchema } from './validation'
import { archiveTask, changeTaskStatus, createTask, updateTask } from './service'

const parseForm = (formData: FormData) =>
  taskInputSchema.safeParse({
    ...Object.fromEntries(formData),
    assigneeIds: formData.getAll('assigneeIds'),
  })

export async function createTaskAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ctx = await requireCtx()
  const parsed = parseForm(formData)
  if (!parsed.success) return { ok: false, error: 'Revisa los campos marcados', fieldErrors: fieldErrorsOf(parsed.error) }
  try {
    await createTask(db, ctx, parsed.data)
  } catch (e) {
    if (e instanceof DomainError) return { ok: false, error: e.message }
    throw e
  }
  revalidatePath('/tareas')
  redirect('/tareas')
}

export async function updateTaskAction(id: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ctx = await requireCtx()
  const parsed = parseForm(formData)
  if (!parsed.success) return { ok: false, error: 'Revisa los campos marcados', fieldErrors: fieldErrorsOf(parsed.error) }
  try {
    await updateTask(db, ctx, id, parsed.data)
  } catch (e) {
    if (e instanceof DomainError) return { ok: false, error: e.message }
    throw e
  }
  revalidatePath('/tareas')
  redirect('/tareas')
}

export async function archiveTaskAction(id: string): Promise<void> {
  const ctx = await requireCtx()
  await archiveTask(db, ctx, id)
  revalidatePath('/tareas')
  redirect('/tareas')
}

export async function changeTaskStatusAction(id: string, statusId: string): Promise<ActionResult> {
  const ctx = await requireCtx()
  try {
    await changeTaskStatus(db, ctx, id, statusId)
  } catch (e) {
    if (e instanceof DomainError) return { ok: false, error: e.message }
    throw e
  }
  revalidatePath('/tareas')
  revalidatePath('/tareas/tablero')
  return { ok: true }
}
```

- [ ] **Step 2: Crear `src/modules/tasks/task-form.tsx`**

```tsx
'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Field } from '@/modules/clients/client-form'
import type { ActionResult } from '@/lib/action-result'
import type { CustomStatus } from '@/modules/customization/service'
import type { Task } from './service'

type Option = { id: string; name: string }
type FormAction = (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>

const PRIORITIES = [['low', 'Baja'], ['medium', 'Media'], ['high', 'Alta'], ['urgent', 'Urgente']] as const

export function TaskForm({ action, milestoneOptions, users, statuses, task, assigneeIds }: {
  action: FormAction
  milestoneOptions: { id: string; label: string }[]
  users: Option[]
  statuses: CustomStatus[]
  task?: Task
  assigneeIds?: string[]
}) {
  const [state, formAction, pending] = useActionState(action, null)
  const errs = state && !state.ok ? (state.fieldErrors ?? {}) : {}
  const select = 'h-9 w-full rounded border px-2 text-sm'
  return (
    <form action={formAction} className="max-w-2xl space-y-4">
      {state && !state.ok && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{state.error}</p>}
      <Field name="milestoneId" label="Hito *" errors={errs.milestoneId}>
        <select id="milestoneId" name="milestoneId" defaultValue={task?.milestoneId ?? ''} required className={select}>
          <option value="">Selecciona…</option>
          {milestoneOptions.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
      </Field>
      <Field name="name" label="Nombre *" errors={errs.name}>
        <Input id="name" name="name" defaultValue={task?.name} required />
      </Field>
      <Field name="description" label="Descripción" errors={errs.description}>
        <Textarea id="description" name="description" defaultValue={task?.description ?? ''} rows={3} />
      </Field>
      <div className="grid grid-cols-3 gap-4">
        <Field name="statusId" label="Estado" errors={errs.statusId}>
          <select id="statusId" name="statusId" defaultValue={task?.statusId ?? ''} className={select}>
            {!task && <option value="">Default (Pendiente)</option>}
            {statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <Field name="priority" label="Prioridad" errors={errs.priority}>
          <select id="priority" name="priority" defaultValue={task?.priority ?? 'medium'} className={select}>
            {PRIORITIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Field>
        <Field name="estimatedHours" label="Horas estimadas" errors={errs.estimatedHours}>
          <Input id="estimatedHours" name="estimatedHours" type="number" step="0.25" min="0" defaultValue={task?.estimatedHours ?? ''} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field name="startDate" label="Fecha de inicio" errors={errs.startDate}>
          <Input id="startDate" name="startDate" type="date" defaultValue={task?.startDate ?? ''} />
        </Field>
        <Field name="dueDate" label="Fecha límite" errors={errs.dueDate}>
          <Input id="dueDate" name="dueDate" type="date" defaultValue={task?.dueDate ?? ''} />
        </Field>
      </div>
      <Field name="assigneeIds" label="Responsables * (Ctrl/Cmd + clic para varios)" errors={errs.assigneeIds}>
        <select id="assigneeIds" name="assigneeIds" multiple required size={Math.min(users.length, 5)}
          defaultValue={assigneeIds ?? []} className="w-full rounded border p-2 text-sm">
          {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isBillableDefault" defaultChecked={task?.isBillableDefault ?? true} />
        Las horas de esta tarea son facturables por defecto
      </label>
      <Button type="submit" disabled={pending}>{pending ? 'Guardando…' : 'Guardar'}</Button>
    </form>
  )
}
```

- [ ] **Step 3: Crear `src/modules/tasks/task-filters.tsx`** (barra de filtros GET + presets)

```tsx
'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import type { CustomStatus } from '@/modules/customization/service'

type Option = { id: string; name: string }

export function TaskFilters({ projects, users, statuses }: { projects: Option[]; users: Option[]; statuses: CustomStatus[] }) {
  const pathname = usePathname()
  const params = useSearchParams()
  const select = 'h-9 rounded border px-2 text-sm'
  const preset = params.get('preset')
  const presetLink = (value: string, label: string) => (
    <Link
      href={preset === value ? pathname : `${pathname}?preset=${value}`}
      className={`rounded-full border px-3 py-1 text-sm ${preset === value ? 'bg-gray-900 text-white' : 'hover:bg-gray-100'}`}
    >
      {label}
    </Link>
  )
  return (
    <div className="mb-4 space-y-2">
      <div className="flex gap-2">
        {presetLink('mias', 'Mis tareas')}
        {presetLink('atrasadas', 'Atrasadas')}
        {presetLink('proximas', 'Próximas a vencer')}
        <Link href={pathname} className="rounded-full border px-3 py-1 text-sm hover:bg-gray-100">Todas</Link>
      </div>
      <form method="GET" className="flex flex-wrap gap-2">
        <select name="proyecto" defaultValue={params.get('proyecto') ?? ''} className={select}>
          <option value="">Todos los proyectos</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select name="responsable" defaultValue={params.get('responsable') ?? ''} className={select}>
          <option value="">Todos los responsables</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <select name="estado" defaultValue={params.get('estado') ?? ''} className={select}>
          <option value="">Todos los estados</option>
          {statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <button type="submit" className="h-9 rounded border px-3 text-sm hover:bg-gray-100">Filtrar</button>
      </form>
    </div>
  )
}
```

- [ ] **Step 4: Crear `src/app/(app)/tareas/page.tsx`**

```tsx
import Link from 'next/link'
import { db } from '@/db'
import { requireCtx } from '@/lib/session'
import { listTasks, type TaskFilters as Filters } from '@/modules/tasks/service'
import { listProjects } from '@/modules/projects/service'
import { listActiveUsers } from '@/modules/auth/service'
import { listStatuses } from '@/modules/customization/service'
import { TaskFilters } from '@/modules/tasks/task-filters'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export default async function TasksPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await requireCtx()
  const params = await searchParams
  const filters: Filters = {
    projectId: params.proyecto || undefined,
    assigneeId: params.responsable || undefined,
    statusId: params.estado || undefined,
  }
  if (params.preset === 'mias') filters.assigneeId = ctx.userId
  if (params.preset === 'atrasadas') filters.overdueOnly = true
  if (params.preset === 'proximas') filters.dueInDays = 7

  const [rows, projects, users, statuses] = await Promise.all([
    listTasks(db, ctx, filters),
    listProjects(db, ctx),
    listActiveUsers(db, ctx.orgId),
    listStatuses(db, ctx, 'task'),
  ])
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Tareas</h1>
        <div className="flex gap-2">
          <Button variant="outline" asChild><Link href="/tareas/tablero">Kanban</Link></Button>
          <Button asChild><Link href="/tareas/nueva">Nueva tarea</Link></Button>
        </div>
      </div>
      <TaskFilters projects={projects.map((p) => ({ id: p.project.id, name: p.project.name }))} users={users} statuses={statuses} />
      {rows.length === 0 ? (
        <p className="text-gray-500">No hay tareas con estos filtros.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tarea</TableHead><TableHead>Proyecto / Hito</TableHead>
              <TableHead>Responsables</TableHead><TableHead>Estado</TableHead>
              <TableHead>Límite</TableHead><TableHead>Est. (h)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(({ task, status, projectName, milestoneName, assignees }) => (
              <TableRow key={task.id}>
                <TableCell><Link className="font-medium hover:underline" href={`/tareas/${task.id}/editar`}>{task.name}</Link></TableCell>
                <TableCell className="text-sm text-gray-600">{projectName} / {milestoneName}</TableCell>
                <TableCell className="text-sm">{assignees.map((a) => a.name).join(', ')}</TableCell>
                <TableCell><Badge style={status.color ? { backgroundColor: status.color } : undefined}>{status.name}</Badge></TableCell>
                <TableCell>{task.dueDate ?? '—'}</TableCell>
                <TableCell>{task.estimatedHours ?? '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Páginas de alta y edición**

Helper compartido para el select agrupado (agregar al final de `src/modules/tasks/service.ts`):

```ts
/** "Project — Milestone" options for the task form. */
export async function listMilestoneOptions(db: Db, ctx: Ctx): Promise<{ id: string; label: string }[]> {
  const rows = await db
    .select({ id: milestones.id, milestoneName: milestones.name, projectName: projects.name })
    .from(milestones)
    .innerJoin(projects, eq(milestones.projectId, projects.id))
    .where(and(eq(milestones.organizationId, ctx.orgId), isNull(milestones.deletedAt), isNull(projects.deletedAt)))
    .orderBy(asc(projects.name), asc(milestones.sortOrder))
  return rows.map((r) => ({ id: r.id, label: `${r.projectName} — ${r.milestoneName}` }))
}
```

`src/app/(app)/tareas/nueva/page.tsx`:

```tsx
import { db } from '@/db'
import { requireCtx } from '@/lib/session'
import { listMilestoneOptions } from '@/modules/tasks/service'
import { listActiveUsers } from '@/modules/auth/service'
import { listStatuses } from '@/modules/customization/service'
import { TaskForm } from '@/modules/tasks/task-form'
import { createTaskAction } from '@/modules/tasks/actions'

export default async function NewTaskPage() {
  const ctx = await requireCtx()
  const [milestoneOptions, users, statuses] = await Promise.all([
    listMilestoneOptions(db, ctx),
    listActiveUsers(db, ctx.orgId),
    listStatuses(db, ctx, 'task'),
  ])
  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Nueva tarea</h1>
      {milestoneOptions.length === 0
        ? <p className="text-gray-500">Primero crea un proyecto con al menos un hito.</p>
        : <TaskForm action={createTaskAction} milestoneOptions={milestoneOptions} users={users} statuses={statuses} />}
    </div>
  )
}
```

`src/app/(app)/tareas/[id]/editar/page.tsx`:

```tsx
import { notFound } from 'next/navigation'
import { db } from '@/db'
import { requireCtx } from '@/lib/session'
import { getTask, getTaskAssigneeIds, listMilestoneOptions } from '@/modules/tasks/service'
import { listActiveUsers } from '@/modules/auth/service'
import { listStatuses } from '@/modules/customization/service'
import { TaskForm } from '@/modules/tasks/task-form'
import { archiveTaskAction, updateTaskAction } from '@/modules/tasks/actions'
import { Button } from '@/components/ui/button'

export default async function EditTaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await requireCtx()
  const task = await getTask(db, ctx, id)
  if (!task) notFound()
  const [milestoneOptions, users, statuses, assigneeIds] = await Promise.all([
    listMilestoneOptions(db, ctx),
    listActiveUsers(db, ctx.orgId),
    listStatuses(db, ctx, 'task'),
    getTaskAssigneeIds(db, ctx, id),
  ])
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Editar tarea</h1>
        <form action={archiveTaskAction.bind(null, id)}>
          <Button variant="destructive" type="submit">Archivar</Button>
        </form>
      </div>
      <TaskForm action={updateTaskAction.bind(null, id)} milestoneOptions={milestoneOptions}
        users={users} statuses={statuses} task={task} assigneeIds={assigneeIds} />
    </div>
  )
}
```

- [ ] **Step 6: Sección de tareas en el detalle del proyecto**

En `src/app/(app)/proyectos/[id]/page.tsx`, reemplazar el placeholder de tareas por:

```tsx
<section id="tareas">
  <div className="mb-2 flex items-center justify-between">
    <h2 className="text-lg font-medium">Tareas</h2>
    <Link className="text-sm hover:underline" href={`/tareas?proyecto=${project.id}`}>Ver en la vista de tareas →</Link>
  </div>
  {taskRows.length === 0 ? (
    <p className="text-sm text-gray-400">Sin tareas todavía. Créalas desde “Tareas → Nueva tarea”.</p>
  ) : (
    <ul className="space-y-1 text-sm">
      {taskRows.map(({ task, status, milestoneName, assignees }) => (
        <li key={task.id} className="flex items-center gap-2">
          <Link className="font-medium hover:underline" href={`/tareas/${task.id}/editar`}>{task.name}</Link>
          <span className="text-gray-500">· {milestoneName} · {assignees.map((a) => a.name).join(', ')}</span>
          <Badge style={status.color ? { backgroundColor: status.color } : undefined}>{status.name}</Badge>
        </li>
      ))}
    </ul>
  )}
</section>
```

con `const taskRows = await listTasks(db, ctx, { projectId: project.id })` en las cargas e importando `listTasks`.

- [ ] **Step 7: Verificación y commit**

Run: `npm run lint && npm run typecheck && npm test && npm run build`
Expected: en verde.
Manual: crear una tarea con 1 responsable, fechas y horas estimadas desde `/tareas/nueva`; verla en `/tareas`; probar los presets "Mis tareas" y filtro por proyecto; editar la tarea y archivar otra.

```bash
git add src/modules/tasks/ "src/app/(app)/tareas/" "src/app/(app)/proyectos/"
git commit -m "feat: add tasks list, filters and forms"
```

---

### Task 12: Tareas — vista Kanban

**Files:**
- Create: `src/app/(app)/tareas/tablero/page.tsx`, `src/modules/tasks/kanban-card.tsx`

**Interfaces:**
- Consumes: `listTasks`, `listStatuses('task')`, `changeTaskStatusAction` (Task 11), `TaskFilters` componente
- Produces: `/tareas/tablero` — columnas = estados del catálogo `task` en su orden; cambiar el estado de una tarjeta la mueve de columna (sin drag & drop en esta iteración; el select de la tarjeta es el mecanismo — spec §5.3: Kanban con columnas por estado personalizado)

- [ ] **Step 1: Crear `src/modules/tasks/kanban-card.tsx`**

```tsx
'use client'

import Link from 'next/link'
import { useTransition } from 'react'
import { toast } from 'sonner'
import type { CustomStatus } from '@/modules/customization/service'
import type { TaskListItem } from './service'
import { changeTaskStatusAction } from './actions'

export function KanbanCard({ item, statuses }: { item: TaskListItem; statuses: CustomStatus[] }) {
  const [pending, startTransition] = useTransition()
  return (
    <div className={`space-y-2 rounded border bg-white p-3 shadow-sm ${pending ? 'opacity-50' : ''}`}>
      <Link href={`/tareas/${item.task.id}/editar`} className="block text-sm font-medium hover:underline">
        {item.task.name}
      </Link>
      <p className="text-xs text-gray-500">{item.projectName} · {item.milestoneName}</p>
      <p className="text-xs text-gray-500">{item.assignees.map((a) => a.name).join(', ') || 'Sin responsable'}</p>
      {item.task.dueDate && <p className="text-xs text-gray-500">Límite: {item.task.dueDate}</p>}
      <select
        value={item.task.statusId}
        disabled={pending}
        onChange={(e) =>
          startTransition(async () => {
            const res = await changeTaskStatusAction(item.task.id, e.target.value)
            if (!res.ok) toast.error(res.error)
          })
        }
        className="h-8 w-full rounded border px-1 text-xs"
      >
        {statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
    </div>
  )
}
```

- [ ] **Step 2: Crear `src/app/(app)/tareas/tablero/page.tsx`**

```tsx
import Link from 'next/link'
import { db } from '@/db'
import { requireCtx } from '@/lib/session'
import { listTasks, type TaskFilters as Filters } from '@/modules/tasks/service'
import { listProjects } from '@/modules/projects/service'
import { listActiveUsers } from '@/modules/auth/service'
import { listStatuses } from '@/modules/customization/service'
import { TaskFilters } from '@/modules/tasks/task-filters'
import { KanbanCard } from '@/modules/tasks/kanban-card'
import { Button } from '@/components/ui/button'

export default async function KanbanPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await requireCtx()
  const params = await searchParams
  const filters: Filters = {
    projectId: params.proyecto || undefined,
    assigneeId: params.responsable || undefined,
  }
  if (params.preset === 'mias') filters.assigneeId = ctx.userId
  if (params.preset === 'atrasadas') filters.overdueOnly = true
  if (params.preset === 'proximas') filters.dueInDays = 7

  const [rows, projects, users, statuses] = await Promise.all([
    listTasks(db, ctx, filters),
    listProjects(db, ctx),
    listActiveUsers(db, ctx.orgId),
    listStatuses(db, ctx, 'task'),
  ])
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Tareas — Kanban</h1>
        <div className="flex gap-2">
          <Button variant="outline" asChild><Link href="/tareas">Lista</Link></Button>
          <Button asChild><Link href="/tareas/nueva">Nueva tarea</Link></Button>
        </div>
      </div>
      <TaskFilters projects={projects.map((p) => ({ id: p.project.id, name: p.project.name }))} users={users} statuses={statuses} />
      <div className="overflow-x-auto">
        <div className="flex gap-4 pb-4">
          {statuses.map((status) => {
            const cards = rows.filter((r) => r.task.statusId === status.id)
            return (
              <div key={status.id} className="w-72 shrink-0 rounded-lg bg-gray-100 p-3">
                <div className="mb-3 flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <span className="inline-block h-3 w-3 rounded-full border" style={{ backgroundColor: status.color ?? '#e5e7eb' }} />
                    {status.name}
                  </span>
                  <span className="text-xs text-gray-500">{cards.length}</span>
                </div>
                <div className="space-y-2">
                  {cards.map((item) => <KanbanCard key={item.task.id} item={item} statuses={statuses} />)}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verificación y commit**

Run: `npm run lint && npm run typecheck && npm test && npm run build`
Expected: en verde.
Manual: `/tareas/tablero` muestra una columna por estado en el orden configurado; cambiar el estado de una tarjeta la mueve de columna; los filtros y presets funcionan igual que en la lista; renombrar un estado en `/configuracion/estados` renombra la columna.

```bash
git add src/modules/tasks/ "src/app/(app)/tareas/"
git commit -m "feat: add kanban board for tasks"
```

---

### Task 13: Campos personalizados básicos — service, configuración y captura en proyectos/tareas

**Files:**
- Create: `src/modules/customization/fields-service.ts`, `src/modules/customization/fields-service.test.ts`, `src/modules/customization/field-manager.tsx`, `src/modules/customization/custom-fields-inputs.tsx`
- Create: `src/app/(app)/configuracion/campos/page.tsx`
- Modify: `src/modules/customization/validation.ts`, `src/modules/customization/actions.ts`, `src/modules/projects/actions.ts`, `src/modules/tasks/actions.ts`, `src/modules/projects/project-form.tsx`, `src/modules/tasks/task-form.tsx`, páginas `nuevo/editar` de proyectos y tareas, `src/components/app-sidebar.tsx` (link a Campos), `src/app/(app)/configuracion/estados/page.tsx` (tabs de navegación entre Estados y Campos)

**Interfaces:**
- Consumes: `customFields`/`customFieldValues` schema (índice único `cfv_field_entity_unique`), `logActivity`
- Produces:
  - Tipos básicos P1 (spec §12.1): `'text' | 'number' | 'date' | 'checkbox'` sobre entidades `'project' | 'task'`
  - `fieldInputSchema` — `{ entityType: 'project' | 'task'; name: string (1–100); fieldType: 'text'|'number'|'date'|'checkbox' }`
  - En `@/modules/customization/fields-service`:
    - `listFields(db, ctx, entityType: 'project' | 'task'): Promise<CustomField[]>` (orden `sortOrder`)
    - `createField(db, ctx, input): Promise<CustomField>` (`sortOrder` = max+1; `DomainError` si ya existe un campo con ese nombre para la entidad)
    - `deleteField(db, ctx, id): Promise<void>` (borra también sus `custom_field_values`)
    - `getFieldValues(db, ctx, entityType, entityId): Promise<Record<string, unknown>>` (mapa `fieldId → value`)
    - `saveFieldValues(db, ctx, entityType, entityId, values: Record<string, unknown>): Promise<void>` (upsert por campo usando el índice único; valor `undefined`/`''` borra la fila)
  - `<CustomFieldsInputs fields values />` — inputs `name="cf_<fieldId>"` para incrustar en ProjectForm/TaskForm
  - `parseCustomFieldValues(fields: CustomField[], formData: FormData): Record<string, unknown>` — convierte según `fieldType` (number → `Number`, checkbox → boolean, resto string)
  - `CustomField = typeof customFields.$inferSelect`

- [ ] **Step 1: Agregar a `src/modules/customization/validation.ts`**

```ts
export const fieldEntityTypes = ['project', 'task'] as const
export const basicFieldTypes = ['text', 'number', 'date', 'checkbox'] as const

export const fieldInputSchema = z.object({
  entityType: z.enum(fieldEntityTypes),
  name: z.string().trim().min(1, 'El nombre es obligatorio').max(100),
  fieldType: z.enum(basicFieldTypes, { message: 'Tipo no soportado en esta iteración' }),
})
```

- [ ] **Step 2: Escribir el test que falla — `src/modules/customization/fields-service.test.ts`**

```ts
import { beforeAll, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import type { Db } from '@/db'
import { createTestDb } from '@/test/db'
import { organizations } from '@/modules/organization/schema'
import { users } from '@/modules/auth/schema'
import { customFieldValues } from './schema'
import type { Ctx } from '@/lib/ctx'
import { DomainError } from '@/lib/errors'
import { createField, deleteField, getFieldValues, listFields, saveFieldValues } from './fields-service'

describe('custom fields service', () => {
  let db: Db
  let ctx: Ctx

  beforeAll(async () => {
    db = await createTestDb()
    const [org] = await db.insert(organizations).values({ name: 'Org' }).returning()
    const [user] = await db.insert(users).values({ organizationId: org.id, name: 'A', email: 'a@x.com', passwordHash: 'x' }).returning()
    ctx = { orgId: org.id, userId: user.id }
  })

  it('creates fields in order and rejects duplicated names per entity', async () => {
    const f1 = await createField(db, ctx, { entityType: 'project', name: 'Orden de compra', fieldType: 'text' })
    const f2 = await createField(db, ctx, { entityType: 'project', name: 'Fecha de firma', fieldType: 'date' })
    expect(f2.sortOrder).toBe(f1.sortOrder + 1)
    expect((await listFields(db, ctx, 'project')).map((f) => f.name)).toEqual(['Orden de compra', 'Fecha de firma'])
    await expect(createField(db, ctx, { entityType: 'project', name: 'Orden de compra', fieldType: 'text' })).rejects.toThrow(DomainError)
  })

  it('saves, upserts and clears values per entity', async () => {
    const field = await createField(db, ctx, { entityType: 'task', name: 'Ambiente', fieldType: 'text' })
    const num = await createField(db, ctx, { entityType: 'task', name: 'Sprint', fieldType: 'number' })
    const entityId = crypto.randomUUID()
    await saveFieldValues(db, ctx, 'task', entityId, { [field.id]: 'QA', [num.id]: 3 })
    expect(await getFieldValues(db, ctx, 'task', entityId)).toEqual({ [field.id]: 'QA', [num.id]: 3 })
    await saveFieldValues(db, ctx, 'task', entityId, { [field.id]: 'Prod', [num.id]: undefined })
    expect(await getFieldValues(db, ctx, 'task', entityId)).toEqual({ [field.id]: 'Prod' })
  })

  it('deleteField removes its values too', async () => {
    const field = await createField(db, ctx, { entityType: 'task', name: 'Borrable', fieldType: 'checkbox' })
    const entityId = crypto.randomUUID()
    await saveFieldValues(db, ctx, 'task', entityId, { [field.id]: true })
    await deleteField(db, ctx, field.id)
    expect((await listFields(db, ctx, 'task')).map((f) => f.id)).not.toContain(field.id)
    expect(await db.select().from(customFieldValues).where(eq(customFieldValues.customFieldId, field.id))).toHaveLength(0)
  })
})
```

- [ ] **Step 3: Correr y verificar que falla**

Run: `npm test`
Expected: FAIL — `./fields-service` no existe.

- [ ] **Step 4: Implementar `src/modules/customization/fields-service.ts`**

```ts
import { and, asc, eq } from 'drizzle-orm'
import type { Db } from '@/db'
import type { Ctx } from '@/lib/ctx'
import { DomainError } from '@/lib/errors'
import { logActivity } from '@/modules/collaboration/service'
import { customFields, customFieldValues } from './schema'

export type CustomField = typeof customFields.$inferSelect
export type FieldEntityType = 'project' | 'task'

export interface FieldInput {
  entityType: FieldEntityType
  name: string
  fieldType: 'text' | 'number' | 'date' | 'checkbox'
}

const byOrg = (ctx: Ctx) => eq(customFields.organizationId, ctx.orgId)

export async function listFields(db: Db, ctx: Ctx, entityType: FieldEntityType): Promise<CustomField[]> {
  return db
    .select()
    .from(customFields)
    .where(and(byOrg(ctx), eq(customFields.entityType, entityType)))
    .orderBy(asc(customFields.sortOrder), asc(customFields.createdAt))
}

export async function createField(db: Db, ctx: Ctx, input: FieldInput): Promise<CustomField> {
  const existing = await listFields(db, ctx, input.entityType)
  if (existing.some((f) => f.name.toLowerCase() === input.name.toLowerCase()))
    throw new DomainError('Ya existe un campo con ese nombre para esta entidad')
  const sortOrder = existing.length ? Math.max(...existing.map((f) => f.sortOrder)) + 1 : 0
  const [field] = await db
    .insert(customFields)
    .values({ organizationId: ctx.orgId, entityType: input.entityType, name: input.name, fieldType: input.fieldType, sortOrder })
    .returning()
  await logActivity(db, ctx, { entityType: 'custom_field', entityId: field.id, action: 'created' })
  return field
}

export async function deleteField(db: Db, ctx: Ctx, id: string): Promise<void> {
  const [field] = await db.select().from(customFields).where(and(byOrg(ctx), eq(customFields.id, id)))
  if (!field) throw new DomainError('Campo no encontrado')
  await db.delete(customFieldValues).where(eq(customFieldValues.customFieldId, id))
  await db.delete(customFields).where(and(byOrg(ctx), eq(customFields.id, id)))
  await logActivity(db, ctx, { entityType: 'custom_field', entityId: id, action: 'deleted' })
}

export async function getFieldValues(db: Db, ctx: Ctx, entityType: FieldEntityType, entityId: string): Promise<Record<string, unknown>> {
  const rows = await db
    .select()
    .from(customFieldValues)
    .where(and(eq(customFieldValues.organizationId, ctx.orgId), eq(customFieldValues.entityType, entityType), eq(customFieldValues.entityId, entityId)))
  return Object.fromEntries(rows.map((r) => [r.customFieldId, r.value]))
}

/** Upsert one row per field via cfv_field_entity_unique; empty values delete the row. */
export async function saveFieldValues(
  db: Db, ctx: Ctx, entityType: FieldEntityType, entityId: string, values: Record<string, unknown>,
): Promise<void> {
  const fields = await listFields(db, ctx, entityType)
  for (const field of fields) {
    if (!(field.id in values)) continue
    const value = values[field.id]
    if (value === undefined || value === '' || value === null) {
      await db.delete(customFieldValues)
        .where(and(eq(customFieldValues.customFieldId, field.id), eq(customFieldValues.entityId, entityId)))
      continue
    }
    await db
      .insert(customFieldValues)
      .values({ organizationId: ctx.orgId, customFieldId: field.id, entityType, entityId, value })
      .onConflictDoUpdate({
        target: [customFieldValues.customFieldId, customFieldValues.entityId],
        set: { value, updatedAt: new Date() },
      })
  }
}

/** FormData → typed values; inputs are named cf_<fieldId>. */
export function parseCustomFieldValues(fields: CustomField[], formData: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const field of fields) {
    const raw = formData.get(`cf_${field.id}`)
    if (field.fieldType === 'checkbox') {
      out[field.id] = raw === 'on' ? true : undefined
    } else if (raw === null || raw === '') {
      out[field.id] = undefined
    } else if (field.fieldType === 'number') {
      const n = Number(raw)
      out[field.id] = Number.isFinite(n) ? n : undefined
    } else {
      out[field.id] = String(raw)
    }
  }
  return out
}
```

- [ ] **Step 5: Correr los tests y verificar que pasan**

Run: `npm test`
Expected: PASS

- [ ] **Step 6: Actions, configuración e integración en formularios**

Agregar a `src/modules/customization/actions.ts`:

```ts
import { fieldInputSchema } from './validation'
import { createField, deleteField } from './fields-service'

export async function createFieldAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ctx = await requireCtx()
  const parsed = fieldInputSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { ok: false, error: 'Revisa los campos', fieldErrors: fieldErrorsOf(parsed.error) }
  try {
    await createField(db, ctx, parsed.data)
  } catch (e) {
    if (e instanceof DomainError) return { ok: false, error: e.message }
    throw e
  }
  revalidatePath('/configuracion/campos')
  return { ok: true }
}

export async function deleteFieldAction(id: string): Promise<ActionResult> {
  const ctx = await requireCtx()
  try {
    await deleteField(db, ctx, id)
  } catch (e) {
    if (e instanceof DomainError) return { ok: false, error: e.message }
    throw e
  }
  revalidatePath('/configuracion/campos')
  return { ok: true }
}
```

Crear `src/modules/customization/field-manager.tsx`:

```tsx
'use client'

import { useActionState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import type { CustomField } from './fields-service'
import { createFieldAction, deleteFieldAction } from './actions'

const TYPE_LABELS: Record<string, string> = { text: 'Texto', number: 'Número', date: 'Fecha', checkbox: 'Casilla' }

export function FieldManager({ entityType, fields }: { entityType: 'project' | 'task'; fields: CustomField[] }) {
  const [state, formAction, pending] = useActionState(createFieldAction, null)
  const [, startTransition] = useTransition()
  return (
    <div className="space-y-2">
      <ul className="space-y-2">
        {fields.map((f) => (
          <li key={f.id} className="flex items-center gap-3 rounded border bg-white p-2">
            <span className="flex-1 font-medium">{f.name}</span>
            <Badge variant="secondary">{TYPE_LABELS[f.fieldType] ?? f.fieldType}</Badge>
            <Button size="sm" variant="ghost" className="text-red-600"
              onClick={() => startTransition(async () => {
                const res = await deleteFieldAction(f.id)
                if (!res.ok) toast.error(res.error)
              })}>
              Eliminar
            </Button>
          </li>
        ))}
      </ul>
      <form action={formAction} className="flex items-center gap-2 rounded border border-dashed p-2">
        <input type="hidden" name="entityType" value={entityType} />
        <Input name="name" placeholder="Nombre del campo" required className="max-w-56" />
        <select name="fieldType" className="h-9 rounded border px-2 text-sm" required>
          {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <Button type="submit" size="sm" disabled={pending}>Agregar</Button>
        {state && !state.ok && <span className="text-sm text-red-600">{state.error}</span>}
      </form>
    </div>
  )
}
```

Crear `src/app/(app)/configuracion/campos/page.tsx`:

```tsx
import Link from 'next/link'
import { db } from '@/db'
import { requireCtx } from '@/lib/session'
import { listFields } from '@/modules/customization/fields-service'
import { FieldManager } from '@/modules/customization/field-manager'

export default async function FieldsSettingsPage() {
  const ctx = await requireCtx()
  const [projectFields, taskFields] = await Promise.all([
    listFields(db, ctx, 'project'),
    listFields(db, ctx, 'task'),
  ])
  return (
    <div className="max-w-3xl space-y-8">
      <div className="flex gap-4 text-sm">
        <Link className="hover:underline" href="/configuracion/estados">Estados</Link>
        <span className="font-semibold">Campos personalizados</span>
      </div>
      <h1 className="text-2xl font-semibold">Configuración — Campos personalizados</h1>
      <p className="text-sm text-gray-500">Tipos básicos en esta iteración: texto, número, fecha y casilla. El resto llega en P4.</p>
      <section>
        <h2 className="mb-2 text-lg font-medium">Proyectos</h2>
        <FieldManager entityType="project" fields={projectFields} />
      </section>
      <section>
        <h2 className="mb-2 text-lg font-medium">Tareas</h2>
        <FieldManager entityType="task" fields={taskFields} />
      </section>
    </div>
  )
}
```

Agregar el mismo bloque de tabs (`Estados` / `Campos personalizados`, invertido) arriba del `h1` en `src/app/(app)/configuracion/estados/page.tsx`.

Crear `src/modules/customization/custom-fields-inputs.tsx`:

```tsx
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { CustomField } from './fields-service'

/** Server-safe inputs (no hooks) named cf_<fieldId>; embed inside any entity form. */
export function CustomFieldsInputs({ fields, values }: { fields: CustomField[]; values: Record<string, unknown> }) {
  if (fields.length === 0) return null
  return (
    <fieldset className="space-y-3 rounded border p-3">
      <legend className="px-1 text-sm font-medium text-gray-600">Campos personalizados</legend>
      {fields.map((f) => {
        const name = `cf_${f.id}`
        const value = values[f.id]
        if (f.fieldType === 'checkbox') {
          return (
            <label key={f.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name={name} defaultChecked={value === true} />
              {f.name}
            </label>
          )
        }
        const type = f.fieldType === 'number' ? 'number' : f.fieldType === 'date' ? 'date' : 'text'
        return (
          <div key={f.id} className="space-y-1">
            <Label htmlFor={name}>{f.name}</Label>
            <Input id={name} name={name} type={type} step={type === 'number' ? 'any' : undefined}
              defaultValue={value != null ? String(value) : ''} />
          </div>
        )
      })}
    </fieldset>
  )
}
```

Integración (mismo patrón en proyectos y tareas):

1. `ProjectForm` y `TaskForm` aceptan una prop nueva `customFields?: React.ReactNode` y la renderizan antes del botón Guardar: `{customFields}`.
2. Las páginas `nuevo`/`editar` cargan `listFields(db, ctx, 'project' | 'task')` y `getFieldValues(...)` (en editar) y pasan `customFields={<CustomFieldsInputs fields={fields} values={values} />}` (en nuevo, `values={{}}`).
3. En `createProjectAction`/`updateProjectAction` (y los de tareas), tras el `createProject`/`updateProject` exitoso:

```ts
const fields = await listFields(db, ctx, 'project') // 'task' en tareas
await saveFieldValues(db, ctx, 'project', id, parseCustomFieldValues(fields, formData))
```

con los imports de `listFields`, `saveFieldValues`, `parseCustomFieldValues` desde `@/modules/customization/fields-service`.

- [ ] **Step 7: Verificación y commit**

Run: `npm run lint && npm run typecheck && npm test && npm run build`
Expected: en verde.
Manual: crear el campo "Orden de compra" (texto) para proyectos y "Sprint" (número) para tareas; capturar valores al editar un proyecto y una tarea; recargar y confirmar que persisten; eliminar un campo y confirmar que desaparece del formulario.

```bash
git add src/modules/customization/ src/modules/projects/ src/modules/tasks/ "src/app/(app)/" src/components/app-sidebar.tsx
git commit -m "feat: add basic custom fields for projects and tasks"
```

---

### Task 14: E2E del flujo de captura, actualización de docs y cierre

**Files:**
- Create: `e2e/hierarchy.spec.ts`
- Modify: `CLAUDE.md` (mención de las rutas nuevas si hace falta — opcional), ninguna otra

**Interfaces:**
- Consumes: toda la iteración; app corriendo con BD sembrada (`.env`)
- Produces: verificación E2E de los criterios 1–6 de def-§10 y cierre con PR

- [ ] **Step 1: Escribir `e2e/hierarchy.spec.ts`**

```ts
import { expect, test } from '@playwright/test'

// Requires a seeded database and SEED_ADMIN_* in .env (same as login.spec.ts).
const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@example.com'
const password = process.env.SEED_ADMIN_PASSWORD ?? 'changeme'
const stamp = Date.now().toString(36)
const names = {
  client: `Cliente E2E ${stamp}`,
  project: `Proyecto E2E ${stamp}`,
  subproject: `Sub E2E ${stamp}`,
  milestone: `Hito E2E ${stamp}`,
  task: `Tarea E2E ${stamp}`,
}

test.describe.configure({ mode: 'serial' })

test.beforeEach(async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Correo electrónico').fill(email)
  await page.getByLabel('Contraseña').fill(password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL('/')
})

test('captures the full hierarchy (def-§10 criteria 1-6)', async ({ page }) => {
  // 1. Cliente
  await page.goto('/clientes/nuevo')
  await page.getByLabel('Nombre comercial *').fill(names.client)
  await page.getByLabel('Tarifa por hora (MXN)').fill('800')
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText(names.client)).toBeVisible()

  // 2. Proyecto
  await page.goto('/proyectos/nuevo')
  await page.getByLabel('Cliente *').selectOption({ label: names.client })
  await page.getByLabel('Nombre *').fill(names.project)
  await page.getByLabel('Responsable *').selectOption({ index: 1 })
  await page.getByLabel('Horas presupuestadas').fill('120')
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByRole('heading', { name: names.project })).toBeVisible()

  // 3. Subproyecto (en el detalle del proyecto)
  await page.getByPlaceholder('Nombre').first().fill(names.subproject)
  await page.getByRole('button', { name: 'Agregar subproyecto' }).click()
  await expect(page.getByText(names.subproject)).toBeVisible()

  // 4. Hito ligado al subproyecto
  await page.getByPlaceholder('Nombre del hito').fill(names.milestone)
  await page.locator('select[name="subprojectId"]').last().selectOption({ label: names.subproject })
  await page.getByRole('button', { name: 'Agregar hito' }).click()
  await expect(page.getByText(names.milestone)).toBeVisible()

  // 5-6. Tarea con responsable, fechas y horas estimadas
  await page.goto('/tareas/nueva')
  await page.getByLabel('Hito *').selectOption({ label: `${names.project} — ${names.milestone}` })
  await page.getByLabel('Nombre *').fill(names.task)
  await page.getByLabel('Horas estimadas').fill('8')
  await page.getByLabel('Fecha límite').fill('2026-12-31')
  await page.locator('select[name="assigneeIds"]').selectOption({ index: 0 })
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page).toHaveURL(/\/tareas/)
  await expect(page.getByText(names.task)).toBeVisible()

  // Kanban: la tarea aparece y puede cambiar de estado
  await page.goto('/tareas/tablero')
  const card = page.locator('div', { hasText: names.task }).locator('select').last()
  await card.selectOption({ label: 'En progreso' })
  await expect(page.getByText(names.task)).toBeVisible()
})
```

- [ ] **Step 2: Correr E2E completo**

Run: `npm run test:e2e`
Expected: PASS (login.spec.ts + hierarchy.spec.ts). Si un selector no coincide con la UI construida, ajustar el selector — no la funcionalidad.

- [ ] **Step 3: Commit**

```bash
git add e2e/
git commit -m "test: add E2E for hierarchy capture flow"
```

- [ ] **Step 4: PR de la task y cierre de la iteración**

Esta task cierra igual que todas (diff → code review → PR de su rama `feat/it1-task-14-e2e`), y además cierra la iteración:

1. `npm run lint && npm run typecheck && npm test && npm run test:e2e` — todo en verde.
2. Mostrar al usuario `git diff master...HEAD --stat`, correr `/code-review` (o revisión con agente independiente si la skill no está disponible para el modelo) y reportar hallazgos de corrección.
3. `git push -u origin feat/it1-task-14-e2e` y `gh pr create` (qué cambia / por qué / cómo verificarlo).
4. Tras el merge del usuario, Vercel despliega: verificar en producción el flujo completo de captura (criterios 1–6) y repasar la "Verificación final de la iteración" de abajo.

---

## Orden de ejecución

Estrictamente secuencial: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13 → 14. (Task 5 debe ir antes que 6 porque los services de proyectos usan `getDefaultStatus`; Task 13 toca formularios creados en 7 y 11.)

## Verificación final de la iteración (spec §9, iteración 1)

- [ ] `npm run lint && npm run typecheck && npm test && npm run test:e2e` en verde local y CI en verde en el PR
- [ ] Criterios def-§10 #1–6 ejecutables en la app: cliente → proyecto → subproyecto → hito → tarea con varios responsables, fechas y horas estimadas
- [ ] Criterio def-§10 #17 (parcial): estados personalizados editables (renombrar/agregar/reordenar/eliminar con guardas) y campos personalizados básicos capturables en proyectos y tareas
- [ ] Toda mutación registró fila en `activity_log` (verificable en Supabase)
- [ ] Ninguna consulta de services sin filtro `organization_id` (tests de aislamiento en verde)
- [ ] Deploy en Vercel funcionando tras merge
