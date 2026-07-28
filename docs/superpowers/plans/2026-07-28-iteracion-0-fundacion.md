# Iteración 0 — Fundación: Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aplicación Next.js desplegada en Vercel con login funcionando, esquema completo de base de datos en Supabase, seed de organización/administrador/catálogos de estados, y CI corriendo lint + typecheck + tests.

**Architecture:** Monolito Next.js (App Router) con código organizado por módulos de dominio (`src/modules/*`); cada módulo aporta su `schema.ts` (Drizzle) agregado en `src/db/schema.ts`. Los tests de integración corren contra PGlite (Postgres embebido) usando las mismas migraciones que producción. Autenticación con Auth.js (credentials + JWT), sin registro público.

**Tech Stack:** Next.js 15+ (App Router), TypeScript estricto, Tailwind CSS, Drizzle ORM + drizzle-kit, PostgreSQL (Supabase), postgres-js, PGlite (tests), Auth.js v5 (`next-auth@beta`), bcryptjs, Zod, Vitest, Playwright, GitHub Actions, Vercel.

**Spec:** `docs/superpowers/specs/2026-07-28-p-erp-mvp1-tech-design.md` (las referencias `§n` de este plan apuntan al spec; las `def-§n` a `docs/mios/definicionMVP1.md`).

## Global Constraints

- TypeScript **estricto** (`"strict": true`); `npm run lint`, `npm run typecheck` y `npm test` deben pasar antes de cada commit.
- UI y datos en **español**; código, identificadores y mensajes de commit en **inglés** (imperativo, asunto ≤72 caracteres).
- **Toda tabla de datos de negocio lleva `organization_id`** (spec §4.1). Ninguna consulta sin filtro de organización.
- Entidades de negocio usan **soft delete** (`deleted_at`), nunca DELETE físico (spec §4.8).
- Las reglas de negocio viven en `service.ts` de cada módulo, **nunca en componentes React** (spec §3).
- Validación con **Zod en cada frontera** (formularios y Server Actions).
- Flujo git: los commits de este plan se hacen en la rama `feat/iteration-0-foundation` creada desde `master`. Commits pequeños, uno por unidad lógica (ver `docs/mios/instruccionesGit.md`).
- Los totales de horas **se calculan en consultas; jamás se almacenan contadores duplicados** (spec §1/§4.3).

---

### Task 1: Scaffold de Next.js con TypeScript estricto

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `postcss.config.mjs`, `.gitignore`, `src/app/{layout,page}.tsx`, `src/app/globals.css` (vía create-next-app)
- Create: `.env.example`

**Interfaces:**
- Consumes: nada (repo solo contiene `docs/`)
- Produces: proyecto Next.js en la raíz del repo con alias `@/* → src/*` y scripts `dev`, `build`, `lint`, `typecheck`

- [ ] **Step 1: Crear la rama de trabajo**

```bash
git checkout -b feat/iteration-0-foundation
```

- [ ] **Step 2: Scaffold en carpeta temporal y mover a la raíz**

`create-next-app` no acepta directorios con contenido arbitrario (existe `docs/`), así que se genera aparte y se mueve:

```bash
npx create-next-app@latest temp-scaffold --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
cp -r temp-scaffold/. .
rm -rf temp-scaffold
```

- [ ] **Step 3: Agregar script `typecheck` y endurecer tsconfig**

En `package.json`, dentro de `"scripts"`, agregar:

```json
"typecheck": "tsc --noEmit"
```

Verificar que `tsconfig.json` tenga `"strict": true` (create-next-app lo trae por defecto; si no, agregarlo).

- [ ] **Step 4: Crear `.env.example`**

```bash
# Postgres de Supabase (usar el connection string "Transaction pooler")
DATABASE_URL=postgresql://user:password@host:6543/postgres
# Generar con: npx auth secret  (o: openssl rand -base64 32)
AUTH_SECRET=changeme
# Credenciales del administrador que crea el seed
SEED_ADMIN_EMAIL=admin@example.com
SEED_ADMIN_PASSWORD=changeme
SEED_ADMIN_NAME=Administrador
SEED_ORG_NAME=iU Corp
```

Confirmar que `.gitignore` incluye `.env*` (create-next-app lo trae; `.env.example` se fuerza con la línea `!.env.example`).

- [ ] **Step 5: Verificar que todo corre**

Run: `npm run lint && npm run typecheck && npm run build`
Expected: los tres comandos terminan sin errores.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js app with strict TypeScript"
```

---

### Task 2: Configurar Vitest

**Files:**
- Create: `vitest.config.ts`
- Create: `src/lib/iso-week.ts`, `src/lib/iso-week.test.ts`
- Modify: `package.json` (scripts)

**Interfaces:**
- Consumes: alias `@/*` de Task 1
- Produces: `npm test` (una corrida) y `npm run test:watch`; utilidad `isoWeekOf(date: Date): { year: number; week: number }` que usarán los reportes semanales en iteraciones futuras

- [ ] **Step 1: Instalar Vitest**

```bash
npm i -D vitest
```

- [ ] **Step 2: Crear `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
})
```

Agregar a `package.json` scripts:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Escribir el test que falla**

`src/lib/iso-week.test.ts` — la semana ISO es la base del reporte semanal (def-§7.8), conviene tenerla correcta desde el día uno:

```ts
import { describe, expect, it } from 'vitest'
import { isoWeekOf } from './iso-week'

describe('isoWeekOf', () => {
  it('returns week 1 for January 1st 2026 (Thursday)', () => {
    expect(isoWeekOf(new Date(Date.UTC(2026, 0, 1)))).toEqual({ year: 2026, week: 1 })
  })

  it('assigns Dec 29th 2025 (Monday) to week 1 of 2026', () => {
    expect(isoWeekOf(new Date(Date.UTC(2025, 11, 29)))).toEqual({ year: 2026, week: 1 })
  })

  it('returns week 53 for Jan 1st 2027 (Friday)', () => {
    expect(isoWeekOf(new Date(Date.UTC(2027, 0, 1)))).toEqual({ year: 2026, week: 53 })
  })
})
```

- [ ] **Step 4: Correr el test y verificar que falla**

Run: `npm test`
Expected: FAIL — `Cannot find module './iso-week'`

- [ ] **Step 5: Implementar `src/lib/iso-week.ts`**

```ts
/** ISO-8601 week: weeks start on Monday; week 1 contains the first Thursday of the year. */
export function isoWeekOf(date: Date): { year: number; week: number } {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  // Shift to the Thursday of the current ISO week.
  const dayOfWeek = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayOfWeek)
  const isoYear = d.getUTCFullYear()
  const yearStart = new Date(Date.UTC(isoYear, 0, 1))
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return { year: isoYear, week }
}
```

- [ ] **Step 6: Correr los tests y verificar que pasan**

Run: `npm test`
Expected: PASS (3 tests)

- [ ] **Step 7: Commit**

```bash
git add vitest.config.ts src/lib/iso-week.ts src/lib/iso-week.test.ts package.json package-lock.json
git commit -m "feat: add Vitest setup and ISO week utility"
```

---

### Task 3: Conexión a base de datos (Drizzle + Supabase)

**Files:**
- Create: `drizzle.config.ts`, `src/db/index.ts`, `src/db/schema.ts`, `src/db/columns.ts`

**Interfaces:**
- Consumes: `.env.example` de Task 1
- Produces:
  - `db` (cliente Drizzle de producción) y tipo `Db` en `@/db` — **todos los services reciben `Db`, nunca importan el cliente concreto**
  - Helpers `idPk()`, `timestamps`, `softDelete` en `@/db/columns`
  - `src/db/schema.ts` como barril que re-exporta los `schema.ts` de todos los módulos

**⚠️ Requiere al usuario:** crear el proyecto en supabase.com (plan free, región más cercana a México) y copiar el connection string "Transaction pooler" a `.env` como `DATABASE_URL`. Pausar y pedirlo si no está listo.

- [ ] **Step 1: Instalar dependencias**

```bash
npm i drizzle-orm postgres dotenv zod
npm i -D drizzle-kit
```

- [ ] **Step 2: Crear `drizzle.config.ts`**

```ts
import 'dotenv/config'
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL! },
})
```

- [ ] **Step 3: Crear helpers de columnas `src/db/columns.ts`**

```ts
import { timestamp, uuid } from 'drizzle-orm/pg-core'

/** UUID primary key with DB-side default. */
export const idPk = () => uuid('id').defaultRandom().primaryKey()

/** Standard audit timestamps for every business table. */
export const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}

/** Soft delete marker (spec §4.8): business entities are never hard-deleted. */
export const softDelete = {
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}
```

- [ ] **Step 4: Crear `src/db/schema.ts` (barril, por ahora vacío) y `src/db/index.ts`**

`src/db/schema.ts`:

```ts
// Aggregates every module's schema. drizzle-kit reads this file.
// Modules are added here as their schema.ts is created (Tasks 4-8).
export {}
```

`src/db/index.ts`:

```ts
import { drizzle } from 'drizzle-orm/postgres-js'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import postgres from 'postgres'
import * as schema from './schema'

/** Driver-agnostic DB type: services depend on this, so tests can pass a PGlite instance. */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>

// prepare: false is required by Supabase's transaction pooler.
const client = postgres(process.env.DATABASE_URL!, { prepare: false })
export const db: Db = drizzle(client, { schema })
```

Agregar scripts a `package.json`:

```json
"db:generate": "drizzle-kit generate",
"db:migrate": "drizzle-kit migrate"
```

- [ ] **Step 5: Verificar**

Run: `npm run lint && npm run typecheck`
Expected: sin errores. (No hay tablas aún; la conexión real se prueba en Task 9 con el seed.)

- [ ] **Step 6: Commit**

```bash
git add drizzle.config.ts src/db/ package.json package-lock.json
git commit -m "feat: add Drizzle setup and database client"
```

---

### Task 4: Esquema — organizations y users, con tests sobre PGlite

**Files:**
- Create: `src/modules/organization/schema.ts`, `src/modules/auth/schema.ts`, `src/test/db.ts`, `src/db/schema.test.ts`
- Modify: `src/db/schema.ts`

**Interfaces:**
- Consumes: `idPk`, `timestamps`, `softDelete` de `@/db/columns`
- Produces:
  - Tablas `organizations` (con `requireTimeApproval`, spec §1/§12.5) y `users` (enum `user_role`: `'admin' | 'member'`)
  - `createTestDb(): Promise<Db>` en `@/test/db` — BD Postgres embebida con migraciones aplicadas, usada por todos los tests de integración

- [ ] **Step 1: Instalar PGlite**

```bash
npm i -D @electric-sql/pglite
```

- [ ] **Step 2: Crear `src/test/db.ts`**

```ts
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import type { Db } from '@/db'
import * as schema from '@/db/schema'

/** In-memory Postgres with the real migrations applied. One instance per test file. */
export async function createTestDb(): Promise<Db> {
  const client = new PGlite()
  const db = drizzle(client, { schema }) as unknown as Db
  await migrate(db as never, { migrationsFolder: './drizzle' })
  return db
}
```

- [ ] **Step 3: Escribir el test que falla — `src/db/schema.test.ts`**

```ts
import { beforeAll, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import type { Db } from '@/db'
import { createTestDb } from '@/test/db'
import { organizations } from '@/modules/organization/schema'
import { users } from '@/modules/auth/schema'

describe('organizations and users schema', () => {
  let db: Db

  beforeAll(async () => {
    db = await createTestDb()
  })

  it('creates an organization with approval disabled by default', async () => {
    const [org] = await db.insert(organizations).values({ name: 'Test Org' }).returning()
    expect(org.requireTimeApproval).toBe(false)
    expect(org.id).toBeTruthy()
  })

  it('creates a user scoped to an organization', async () => {
    const [org] = await db.insert(organizations).values({ name: 'Org A' }).returning()
    const [user] = await db
      .insert(users)
      .values({
        organizationId: org.id,
        name: 'Ana',
        email: 'ana@example.com',
        passwordHash: 'x',
        role: 'admin',
      })
      .returning()
    expect(user.role).toBe('admin')
    const found = await db.select().from(users).where(eq(users.email, 'ana@example.com'))
    expect(found).toHaveLength(1)
  })

  it('rejects duplicate emails', async () => {
    const [org] = await db.insert(organizations).values({ name: 'Org B' }).returning()
    const base = { organizationId: org.id, name: 'Bo', passwordHash: 'x' } as const
    await db.insert(users).values({ ...base, email: 'dup@example.com' })
    await expect(db.insert(users).values({ ...base, email: 'dup@example.com' })).rejects.toThrow()
  })
})
```

- [ ] **Step 4: Correr el test y verificar que falla**

Run: `npm test`
Expected: FAIL — módulos de schema inexistentes.

- [ ] **Step 5: Implementar los schemas**

`src/modules/organization/schema.ts`:

```ts
import { boolean, pgTable, varchar } from 'drizzle-orm/pg-core'
import { idPk, timestamps } from '@/db/columns'

export const organizations = pgTable('organizations', {
  id: idPk(),
  name: varchar('name', { length: 200 }).notNull(),
  /** spec §12.5: when false, time entries skip the approval flow. Default off for the pilot. */
  requireTimeApproval: boolean('require_time_approval').default(false).notNull(),
  ...timestamps,
})
```

`src/modules/auth/schema.ts`:

```ts
import { boolean, pgEnum, pgTable, text, uuid, varchar } from 'drizzle-orm/pg-core'
import { idPk, softDelete, timestamps } from '@/db/columns'
import { organizations } from '@/modules/organization/schema'

export const userRole = pgEnum('user_role', ['admin', 'member'])

export const users = pgTable('users', {
  id: idPk(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  name: varchar('name', { length: 200 }).notNull(),
  email: varchar('email', { length: 320 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: userRole('role').default('member').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  ...timestamps,
  ...softDelete,
})
```

`src/db/schema.ts` (reemplazar el contenido):

```ts
// Aggregates every module's schema. drizzle-kit reads this file.
export * from '@/modules/organization/schema'
export * from '@/modules/auth/schema'
```

- [ ] **Step 6: Generar la migración**

Run: `npm run db:generate`
Expected: aparece `drizzle/0000_*.sql` con `CREATE TABLE organizations` y `users`.

- [ ] **Step 7: Correr los tests y verificar que pasan**

Run: `npm test`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/modules/organization/ src/modules/auth/schema.ts src/db/schema.ts src/test/ src/db/schema.test.ts drizzle/ package.json package-lock.json
git commit -m "feat: add organizations and users schema with PGlite test harness"
```

---

### Task 5: Esquema — personalización (estados y campos personalizados) y catálogos

**Files:**
- Create: `src/modules/customization/schema.ts`, `src/modules/customization/catalogs.ts`, `src/modules/customization/catalogs.test.ts`
- Modify: `src/db/schema.ts`

**Interfaces:**
- Consumes: `organizations` de Task 4
- Produces:
  - Tablas `custom_statuses` (enum `status_category`: `'open' | 'in_progress' | 'blocked' | 'done' | 'cancelled'`, spec §4.5), `custom_fields` (enum `custom_field_type` con los 8 tipos de def-§5.4), `custom_field_values`
  - `STATUS_CATALOGS: StatusCatalogEntry[]` en `@/modules/customization/catalogs` — los estados iniciales de def-§5.2 que el seed (Task 9) inserta
  - Tipo `StatusEntityType = 'project' | 'project_health' | 'milestone' | 'task'`

Nota de diseño: los subproyectos reutilizan el catálogo `project`; aprobación de horas, facturación y carga de trabajo son máquinas de estado del sistema (enums en código), **no** estados personalizables. `project_health` es un indicador, no un flujo: sus filas llevan `category: null`.

- [ ] **Step 1: Escribir el test que falla — `src/modules/customization/catalogs.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import { STATUS_CATALOGS } from './catalogs'

describe('STATUS_CATALOGS (def-§5.2)', () => {
  it('covers the four customizable entity types', () => {
    const types = new Set(STATUS_CATALOGS.map((s) => s.entityType))
    expect(types).toEqual(new Set(['project', 'project_health', 'milestone', 'task']))
  })

  it('has exactly one default status per entity type', () => {
    for (const type of ['project', 'project_health', 'milestone', 'task'] as const) {
      const defaults = STATUS_CATALOGS.filter((s) => s.entityType === type && s.isDefault)
      expect(defaults, `defaults for ${type}`).toHaveLength(1)
    }
  })

  it('assigns a workflow category to every status except project_health', () => {
    for (const s of STATUS_CATALOGS) {
      if (s.entityType === 'project_health') expect(s.category).toBeNull()
      else expect(s.category).not.toBeNull()
    }
  })

  it('includes the spanish project states from the definition', () => {
    const names = STATUS_CATALOGS.filter((s) => s.entityType === 'project').map((s) => s.name)
    expect(names).toEqual(['Borrador', 'Planeación', 'Activo', 'En pausa', 'En riesgo', 'Completado', 'Cancelado'])
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npm test`
Expected: FAIL — `./catalogs` no existe.

- [ ] **Step 3: Implementar `src/modules/customization/schema.ts`**

```ts
import { boolean, integer, jsonb, pgEnum, pgTable, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core'
import { idPk, timestamps } from '@/db/columns'
import { organizations } from '@/modules/organization/schema'

/** Fixed system category behind every custom status, so reports/kanban survive renames (spec §4.5). */
export const statusCategory = pgEnum('status_category', ['open', 'in_progress', 'blocked', 'done', 'cancelled'])

/** The 8 supported custom field types (def-§5.4). */
export const customFieldType = pgEnum('custom_field_type', [
  'text', 'number', 'date', 'select', 'multi_select', 'checkbox', 'user', 'link',
])

export const customStatuses = pgTable('custom_statuses', {
  id: idPk(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  /** 'project' | 'project_health' | 'milestone' | 'task' — subprojects reuse 'project'. */
  entityType: varchar('entity_type', { length: 30 }).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  /** null only for 'project_health' (indicator, not workflow). */
  category: statusCategory('category'),
  color: varchar('color', { length: 7 }),
  sortOrder: integer('sort_order').default(0).notNull(),
  isDefault: boolean('is_default').default(false).notNull(),
  ...timestamps,
})

export const customFields = pgTable('custom_fields', {
  id: idPk(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  entityType: varchar('entity_type', { length: 30 }).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  fieldType: customFieldType('field_type').notNull(),
  /** For select/multi_select: { options: string[] }. */
  options: jsonb('options'),
  sortOrder: integer('sort_order').default(0).notNull(),
  ...timestamps,
})

export const customFieldValues = pgTable(
  'custom_field_values',
  {
    id: idPk(),
    organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
    customFieldId: uuid('custom_field_id').references(() => customFields.id).notNull(),
    entityType: varchar('entity_type', { length: 30 }).notNull(),
    entityId: uuid('entity_id').notNull(),
    value: jsonb('value'),
    ...timestamps,
  },
  (t) => [uniqueIndex('cfv_field_entity_unique').on(t.customFieldId, t.entityId)],
)
```

- [ ] **Step 4: Implementar `src/modules/customization/catalogs.ts`**

```ts
export type StatusEntityType = 'project' | 'project_health' | 'milestone' | 'task'
export type StatusCategory = 'open' | 'in_progress' | 'blocked' | 'done' | 'cancelled'

export interface StatusCatalogEntry {
  entityType: StatusEntityType
  name: string
  category: StatusCategory | null
  sortOrder: number
  isDefault: boolean
}

const entry = (
  entityType: StatusEntityType,
  name: string,
  category: StatusCategory | null,
  sortOrder: number,
  isDefault = false,
): StatusCatalogEntry => ({ entityType, name, category, sortOrder, isDefault })

/** Initial status catalogs from def-§5.2, seeded as editable rows (spec §12.1). */
export const STATUS_CATALOGS: StatusCatalogEntry[] = [
  entry('project', 'Borrador', 'open', 0, true),
  entry('project', 'Planeación', 'open', 1),
  entry('project', 'Activo', 'in_progress', 2),
  entry('project', 'En pausa', 'blocked', 3),
  entry('project', 'En riesgo', 'in_progress', 4),
  entry('project', 'Completado', 'done', 5),
  entry('project', 'Cancelado', 'cancelled', 6),

  entry('project_health', 'En tiempo', null, 0, true),
  entry('project_health', 'Requiere atención', null, 1),
  entry('project_health', 'En riesgo', null, 2),
  entry('project_health', 'Retrasado', null, 3),

  entry('milestone', 'Pendiente', 'open', 0, true),
  entry('milestone', 'En progreso', 'in_progress', 1),
  entry('milestone', 'Bloqueado', 'blocked', 2),
  entry('milestone', 'En revisión', 'in_progress', 3),
  entry('milestone', 'Completado', 'done', 4),
  entry('milestone', 'Cancelado', 'cancelled', 5),

  entry('task', 'Pendiente', 'open', 0, true),
  entry('task', 'En progreso', 'in_progress', 1),
  entry('task', 'En revisión', 'in_progress', 2),
  entry('task', 'Bloqueada', 'blocked', 3),
  entry('task', 'Completada', 'done', 4),
  entry('task', 'Cancelada', 'cancelled', 5),
]
```

- [ ] **Step 5: Registrar en el barril y generar migración**

En `src/db/schema.ts` agregar:

```ts
export * from '@/modules/customization/schema'
```

Run: `npm run db:generate`
Expected: nueva migración `drizzle/0001_*.sql` con las tres tablas.

- [ ] **Step 6: Correr los tests y verificar que pasan**

Run: `npm test`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/modules/customization/ src/db/schema.ts drizzle/
git commit -m "feat: add customization schema and initial status catalogs"
```

---

### Task 6: Esquema — clients, projects, project_members, subprojects, milestones

**Files:**
- Create: `src/modules/clients/schema.ts`, `src/modules/projects/schema.ts`, `src/modules/projects/schema.test.ts`
- Modify: `src/db/schema.ts`

**Interfaces:**
- Consumes: `organizations`, `users`, `customStatuses` de Tasks 4-5
- Produces:
  - `clients` (con `hourlyRate` default de tarifa, spec §12.4)
  - `projects` (con `budgetedHours` manual —spec §12.3—, `hourlyRate` que sobrescribe al cliente, `statusId` y `healthId` → `custom_statuses`, enum `priority`: `'low' | 'medium' | 'high' | 'urgent'`)
  - `projectMembers` (participantes), `subprojects` (opcionales, spec §4.2), `milestones` (`projectId` obligatorio, `subprojectId` opcional, `sortOrder`)

- [ ] **Step 1: Escribir el test que falla — `src/modules/projects/schema.test.ts`**

```ts
import { beforeAll, describe, expect, it } from 'vitest'
import type { Db } from '@/db'
import { createTestDb } from '@/test/db'
import { organizations } from '@/modules/organization/schema'
import { users } from '@/modules/auth/schema'
import { customStatuses } from '@/modules/customization/schema'
import { clients } from '@/modules/clients/schema'
import { milestones, projects, subprojects } from '@/modules/projects/schema'

describe('hierarchy schema (def-§4.1)', () => {
  let db: Db
  let ids: { orgId: string; userId: string; clientId: string; projectStatusId: string; milestoneStatusId: string }

  beforeAll(async () => {
    db = await createTestDb()
    const [org] = await db.insert(organizations).values({ name: 'Org' }).returning()
    const [user] = await db
      .insert(users)
      .values({ organizationId: org.id, name: 'Ana', email: 'a@x.com', passwordHash: 'x' })
      .returning()
    const [pStatus] = await db
      .insert(customStatuses)
      .values({ organizationId: org.id, entityType: 'project', name: 'Activo', category: 'in_progress' })
      .returning()
    const [mStatus] = await db
      .insert(customStatuses)
      .values({ organizationId: org.id, entityType: 'milestone', name: 'Pendiente', category: 'open' })
      .returning()
    const [client] = await db
      .insert(clients)
      .values({ organizationId: org.id, commercialName: 'ACME', hourlyRate: '800.00' })
      .returning()
    ids = { orgId: org.id, userId: user.id, clientId: client.id, projectStatusId: pStatus.id, milestoneStatusId: mStatus.id }
  })

  it('creates a project with budget and rate override', async () => {
    const [project] = await db
      .insert(projects)
      .values({
        organizationId: ids.orgId,
        clientId: ids.clientId,
        name: 'Sitio web',
        responsibleId: ids.userId,
        statusId: ids.projectStatusId,
        budgetedHours: '120.00',
        hourlyRate: '950.00',
      })
      .returning()
    expect(project.priority).toBe('medium')
    expect(project.budgetedHours).toBe('120.00')
  })

  it('allows milestones directly under a project (no subproject)', async () => {
    const [project] = await db
      .insert(projects)
      .values({ organizationId: ids.orgId, clientId: ids.clientId, name: 'P2', responsibleId: ids.userId, statusId: ids.projectStatusId })
      .returning()
    const [milestone] = await db
      .insert(milestones)
      .values({ organizationId: ids.orgId, projectId: project.id, name: 'Entrega 1', statusId: ids.milestoneStatusId })
      .returning()
    expect(milestone.subprojectId).toBeNull()
  })

  it('links milestones to an optional subproject', async () => {
    const [project] = await db
      .insert(projects)
      .values({ organizationId: ids.orgId, clientId: ids.clientId, name: 'P3', responsibleId: ids.userId, statusId: ids.projectStatusId })
      .returning()
    const [sub] = await db
      .insert(subprojects)
      .values({ organizationId: ids.orgId, projectId: project.id, name: 'Backend', statusId: ids.projectStatusId })
      .returning()
    const [milestone] = await db
      .insert(milestones)
      .values({ organizationId: ids.orgId, projectId: project.id, subprojectId: sub.id, name: 'API lista', statusId: ids.milestoneStatusId })
      .returning()
    expect(milestone.subprojectId).toBe(sub.id)
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npm test`
Expected: FAIL — schemas inexistentes.

- [ ] **Step 3: Implementar `src/modules/clients/schema.ts`**

```ts
import { boolean, numeric, pgTable, text, uuid, varchar } from 'drizzle-orm/pg-core'
import { idPk, softDelete, timestamps } from '@/db/columns'
import { organizations } from '@/modules/organization/schema'

export const clients = pgTable('clients', {
  id: idPk(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  commercialName: varchar('commercial_name', { length: 200 }).notNull(),
  legalName: varchar('legal_name', { length: 200 }),
  contactName: varchar('contact_name', { length: 200 }),
  email: varchar('email', { length: 320 }),
  phone: varchar('phone', { length: 30 }),
  isActive: boolean('is_active').default(true).notNull(),
  /** Default hourly rate; projects may override it (spec §12.4). */
  hourlyRate: numeric('hourly_rate', { precision: 10, scale: 2 }),
  notes: text('notes'),
  ...timestamps,
  ...softDelete,
})
```

- [ ] **Step 4: Implementar `src/modules/projects/schema.ts`**

```ts
import { date, integer, numeric, pgEnum, pgTable, primaryKey, text, uuid, varchar } from 'drizzle-orm/pg-core'
import { idPk, softDelete, timestamps } from '@/db/columns'
import { organizations } from '@/modules/organization/schema'
import { users } from '@/modules/auth/schema'
import { clients } from '@/modules/clients/schema'
import { customStatuses } from '@/modules/customization/schema'

export const priority = pgEnum('priority', ['low', 'medium', 'high', 'urgent'])

export const projects = pgTable('projects', {
  id: idPk(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  clientId: uuid('client_id').references(() => clients.id).notNull(),
  name: varchar('name', { length: 200 }).notNull(),
  description: text('description'),
  responsibleId: uuid('responsible_id').references(() => users.id).notNull(),
  statusId: uuid('status_id').references(() => customStatuses.id).notNull(),
  /** Optional health indicator; rows with entityType 'project_health'. */
  healthId: uuid('health_id').references(() => customStatuses.id),
  priority: priority('priority').default('medium').notNull(),
  startDate: date('start_date'),
  dueDate: date('due_date'),
  /** Manually captured budget (spec §12.3); consolidated estimates are always computed in queries. */
  budgetedHours: numeric('budgeted_hours', { precision: 8, scale: 2 }),
  /** Overrides clients.hourlyRate when set (spec §12.4). */
  hourlyRate: numeric('hourly_rate', { precision: 10, scale: 2 }),
  ...timestamps,
  ...softDelete,
})

export const projectMembers = pgTable(
  'project_members',
  {
    projectId: uuid('project_id').references(() => projects.id).notNull(),
    userId: uuid('user_id').references(() => users.id).notNull(),
  },
  (t) => [primaryKey({ columns: [t.projectId, t.userId] })],
)

/** Optional level (spec §4.2): small projects hang milestones directly. Reuses the 'project' status catalog. */
export const subprojects = pgTable('subprojects', {
  id: idPk(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  projectId: uuid('project_id').references(() => projects.id).notNull(),
  name: varchar('name', { length: 200 }).notNull(),
  description: text('description'),
  responsibleId: uuid('responsible_id').references(() => users.id),
  statusId: uuid('status_id').references(() => customStatuses.id).notNull(),
  startDate: date('start_date'),
  dueDate: date('due_date'),
  ...timestamps,
  ...softDelete,
})

export const milestones = pgTable('milestones', {
  id: idPk(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  projectId: uuid('project_id').references(() => projects.id).notNull(),
  subprojectId: uuid('subproject_id').references(() => subprojects.id),
  name: varchar('name', { length: 200 }).notNull(),
  description: text('description'),
  responsibleId: uuid('responsible_id').references(() => users.id),
  statusId: uuid('status_id').references(() => customStatuses.id).notNull(),
  targetDate: date('target_date'),
  sortOrder: integer('sort_order').default(0).notNull(),
  ...timestamps,
  ...softDelete,
})
```

- [ ] **Step 5: Registrar en el barril y generar migración**

En `src/db/schema.ts` agregar:

```ts
export * from '@/modules/clients/schema'
export * from '@/modules/projects/schema'
```

Run: `npm run db:generate`
Expected: nueva migración con `clients`, `projects`, `project_members`, `subprojects`, `milestones`.

- [ ] **Step 6: Correr los tests y verificar que pasan**

Run: `npm test`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/modules/clients/ src/modules/projects/ src/db/schema.ts drizzle/
git commit -m "feat: add clients, projects, subprojects and milestones schema"
```

---

### Task 7: Esquema — tasks, task_assignees, time_entries

**Files:**
- Create: `src/modules/tasks/schema.ts`, `src/modules/time/schema.ts`, `src/modules/time/schema.test.ts`
- Modify: `src/db/schema.ts`

**Interfaces:**
- Consumes: tablas de Tasks 4-6
- Produces:
  - `tasks` (con `estimatedHours`, `isBillableDefault`, N responsables vía `taskAssignees`)
  - `timeEntries` con la **doble máquina de estados** (spec §4.4): enum `approval_status` (`'draft' | 'submitted' | 'approved' | 'rejected'`) y enum `billing_status` (`'non_billable' | 'pending_billing' | 'in_billing_cut' | 'billed'`), más `clientId`/`projectId` denormalizados para reportes (def-§7.6)

- [ ] **Step 1: Escribir el test que falla — `src/modules/time/schema.test.ts`**

```ts
import { beforeAll, describe, expect, it } from 'vitest'
import type { Db } from '@/db'
import { createTestDb } from '@/test/db'
import { organizations } from '@/modules/organization/schema'
import { users } from '@/modules/auth/schema'
import { customStatuses } from '@/modules/customization/schema'
import { clients } from '@/modules/clients/schema'
import { milestones, projects } from '@/modules/projects/schema'
import { taskAssignees, tasks } from '@/modules/tasks/schema'
import { timeEntries } from '@/modules/time/schema'

describe('tasks and time entries schema', () => {
  let db: Db
  let ctx: { orgId: string; userA: string; userB: string; clientId: string; projectId: string; taskId: string }

  beforeAll(async () => {
    db = await createTestDb()
    const [org] = await db.insert(organizations).values({ name: 'Org' }).returning()
    const [ua] = await db.insert(users).values({ organizationId: org.id, name: 'A', email: 'a@x.com', passwordHash: 'x' }).returning()
    const [ub] = await db.insert(users).values({ organizationId: org.id, name: 'B', email: 'b@x.com', passwordHash: 'x' }).returning()
    const [ps] = await db.insert(customStatuses).values({ organizationId: org.id, entityType: 'project', name: 'Activo', category: 'in_progress' }).returning()
    const [ms] = await db.insert(customStatuses).values({ organizationId: org.id, entityType: 'milestone', name: 'Pendiente', category: 'open' }).returning()
    const [ts] = await db.insert(customStatuses).values({ organizationId: org.id, entityType: 'task', name: 'Pendiente', category: 'open' }).returning()
    const [client] = await db.insert(clients).values({ organizationId: org.id, commercialName: 'ACME' }).returning()
    const [project] = await db.insert(projects).values({ organizationId: org.id, clientId: client.id, name: 'P', responsibleId: ua.id, statusId: ps.id }).returning()
    const [milestone] = await db.insert(milestones).values({ organizationId: org.id, projectId: project.id, name: 'M', statusId: ms.id }).returning()
    const [task] = await db.insert(tasks).values({ organizationId: org.id, projectId: project.id, milestoneId: milestone.id, name: 'T', statusId: ts.id, estimatedHours: '8.00' }).returning()
    ctx = { orgId: org.id, userA: ua.id, userB: ub.id, clientId: client.id, projectId: project.id, taskId: task.id }
  })

  it('supports multiple assignees per task (def-§7.5)', async () => {
    await db.insert(taskAssignees).values([
      { taskId: ctx.taskId, userId: ctx.userA },
      { taskId: ctx.taskId, userId: ctx.userB },
    ])
    const rows = await db.select().from(taskAssignees)
    expect(rows).toHaveLength(2)
  })

  it('creates a time entry starting as draft and non-billable', async () => {
    const [entry] = await db
      .insert(timeEntries)
      .values({
        organizationId: ctx.orgId,
        userId: ctx.userA,
        clientId: ctx.clientId,
        projectId: ctx.projectId,
        taskId: ctx.taskId,
        date: '2026-07-27',
        hours: '2.50',
        isBillable: true,
      })
      .returning()
    expect(entry.approvalStatus).toBe('draft')
    expect(entry.billingStatus).toBe('non_billable')
    expect(entry.hours).toBe('2.50')
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npm test`
Expected: FAIL — schemas inexistentes.

- [ ] **Step 3: Implementar `src/modules/tasks/schema.ts`**

```ts
import { boolean, date, numeric, pgTable, primaryKey, text, uuid, varchar } from 'drizzle-orm/pg-core'
import { idPk, softDelete, timestamps } from '@/db/columns'
import { organizations } from '@/modules/organization/schema'
import { users } from '@/modules/auth/schema'
import { customStatuses } from '@/modules/customization/schema'
import { milestones, priority, projects, subprojects } from '@/modules/projects/schema'

export const tasks = pgTable('tasks', {
  id: idPk(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  projectId: uuid('project_id').references(() => projects.id).notNull(),
  subprojectId: uuid('subproject_id').references(() => subprojects.id),
  milestoneId: uuid('milestone_id').references(() => milestones.id).notNull(),
  name: varchar('name', { length: 200 }).notNull(),
  description: text('description'),
  statusId: uuid('status_id').references(() => customStatuses.id).notNull(),
  priority: priority('priority').default('medium').notNull(),
  startDate: date('start_date'),
  dueDate: date('due_date'),
  estimatedHours: numeric('estimated_hours', { precision: 8, scale: 2 }),
  /** Pre-fills is_billable on new time entries for this task. */
  isBillableDefault: boolean('is_billable_default').default(true).notNull(),
  ...timestamps,
  ...softDelete,
})

export const taskAssignees = pgTable(
  'task_assignees',
  {
    taskId: uuid('task_id').references(() => tasks.id).notNull(),
    userId: uuid('user_id').references(() => users.id).notNull(),
  },
  (t) => [primaryKey({ columns: [t.taskId, t.userId] })],
)
```

- [ ] **Step 4: Implementar `src/modules/time/schema.ts`**

```ts
import { boolean, date, numeric, pgEnum, pgTable, text, uuid } from 'drizzle-orm/pg-core'
import { idPk, softDelete, timestamps } from '@/db/columns'
import { organizations } from '@/modules/organization/schema'
import { users } from '@/modules/auth/schema'
import { clients } from '@/modules/clients/schema'
import { milestones, projects, subprojects } from '@/modules/projects/schema'
import { tasks } from '@/modules/tasks/schema'

/** System state machines (spec §4.4) — NOT customizable statuses. */
export const approvalStatus = pgEnum('approval_status', ['draft', 'submitted', 'approved', 'rejected'])
export const billingStatus = pgEnum('billing_status', ['non_billable', 'pending_billing', 'in_billing_cut', 'billed'])

export const timeEntries = pgTable('time_entries', {
  id: idPk(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  /** client/project denormalized for weekly reports (def-§7.6); always derived from the task on write. */
  clientId: uuid('client_id').references(() => clients.id).notNull(),
  projectId: uuid('project_id').references(() => projects.id).notNull(),
  subprojectId: uuid('subproject_id').references(() => subprojects.id),
  milestoneId: uuid('milestone_id').references(() => milestones.id),
  taskId: uuid('task_id').references(() => tasks.id).notNull(),
  date: date('date').notNull(),
  hours: numeric('hours', { precision: 5, scale: 2 }).notNull(),
  description: text('description'),
  isBillable: boolean('is_billable').default(false).notNull(),
  /** Rule (spec §12.5): billing_status may only leave 'non_billable' if approved or approval is disabled. Enforced in time/service.ts (iteración 2). */
  approvalStatus: approvalStatus('approval_status').default('draft').notNull(),
  billingStatus: billingStatus('billing_status').default('non_billable').notNull(),
  ...timestamps,
  ...softDelete,
})
```

- [ ] **Step 5: Registrar en el barril y generar migración**

En `src/db/schema.ts` agregar:

```ts
export * from '@/modules/tasks/schema'
export * from '@/modules/time/schema'
```

Run: `npm run db:generate`
Expected: nueva migración con `tasks`, `task_assignees`, `time_entries`.

- [ ] **Step 6: Correr los tests y verificar que pasan**

Run: `npm test`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/modules/tasks/ src/modules/time/ src/db/schema.ts drizzle/
git commit -m "feat: add tasks and time entries schema with dual state machines"
```

---

### Task 8: Esquema — colaboración (polimórfico) y ai_usage

**Files:**
- Create: `src/modules/collaboration/schema.ts`, `src/modules/collaboration/schema.test.ts`, `src/modules/ai/schema.ts`
- Modify: `src/db/schema.ts`

**Interfaces:**
- Consumes: `organizations`, `users` de Task 4
- Produces:
  - `comments` (con `parentId` para respuestas), `activityLog` (con `changes` jsonb antes/después, spec §7), `notifications`, `attachments` — todos polimórficos vía `entityType` + `entityId` (spec §4.7)
  - `aiUsage` (tokens y resultado por llamada, spec §6)

- [ ] **Step 1: Escribir el test que falla — `src/modules/collaboration/schema.test.ts`**

```ts
import { beforeAll, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import type { Db } from '@/db'
import { createTestDb } from '@/test/db'
import { organizations } from '@/modules/organization/schema'
import { users } from '@/modules/auth/schema'
import { activityLog, comments } from '@/modules/collaboration/schema'

describe('polymorphic collaboration schema (spec §4.7)', () => {
  let db: Db
  let orgId: string
  let userId: string

  beforeAll(async () => {
    db = await createTestDb()
    const [org] = await db.insert(organizations).values({ name: 'Org' }).returning()
    const [user] = await db.insert(users).values({ organizationId: org.id, name: 'A', email: 'a@x.com', passwordHash: 'x' }).returning()
    orgId = org.id
    userId = user.id
  })

  it('attaches comments to any entity type', async () => {
    const fakeProjectId = crypto.randomUUID()
    const fakeTaskId = crypto.randomUUID()
    await db.insert(comments).values([
      { organizationId: orgId, authorId: userId, entityType: 'project', entityId: fakeProjectId, body: 'Comentario en proyecto' },
      { organizationId: orgId, authorId: userId, entityType: 'task', entityId: fakeTaskId, body: 'Comentario en tarea' },
    ])
    const onProject = await db.select().from(comments).where(eq(comments.entityType, 'project'))
    expect(onProject).toHaveLength(1)
  })

  it('records before/after changes in the activity log', async () => {
    const [row] = await db
      .insert(activityLog)
      .values({
        organizationId: orgId,
        actorId: userId,
        entityType: 'task',
        entityId: crypto.randomUUID(),
        action: 'status_changed',
        changes: { before: { status: 'Pendiente' }, after: { status: 'En progreso' } },
      })
      .returning()
    expect(row.changes).toEqual({ before: { status: 'Pendiente' }, after: { status: 'En progreso' } })
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npm test`
Expected: FAIL — schema inexistente.

- [ ] **Step 3: Implementar `src/modules/collaboration/schema.ts`**

```ts
import { bigint, jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { idPk, softDelete, timestamps } from '@/db/columns'
import { organizations } from '@/modules/organization/schema'
import { users } from '@/modules/auth/schema'
import type { AnyPgColumn } from 'drizzle-orm/pg-core'

export const comments = pgTable('comments', {
  id: idPk(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  authorId: uuid('author_id').references(() => users.id).notNull(),
  entityType: varchar('entity_type', { length: 30 }).notNull(),
  entityId: uuid('entity_id').notNull(),
  /** Reply threading (def-§8). */
  parentId: uuid('parent_id').references((): AnyPgColumn => comments.id),
  body: text('body').notNull(),
  ...timestamps,
  ...softDelete,
})

/** Doubles as audit trail (spec §7): who, what, when, before/after. Never deleted. */
export const activityLog = pgTable('activity_log', {
  id: idPk(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  actorId: uuid('actor_id').references(() => users.id).notNull(),
  entityType: varchar('entity_type', { length: 30 }).notNull(),
  entityId: uuid('entity_id').notNull(),
  action: varchar('action', { length: 60 }).notNull(),
  changes: jsonb('changes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const notifications = pgTable('notifications', {
  id: idPk(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  type: varchar('type', { length: 40 }).notNull(),
  entityType: varchar('entity_type', { length: 30 }).notNull(),
  entityId: uuid('entity_id').notNull(),
  message: text('message').notNull(),
  readAt: timestamp('read_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

/** Metadata only; binary lives in Supabase Storage under storagePath (spec §2). */
export const attachments = pgTable('attachments', {
  id: idPk(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  uploaderId: uuid('uploader_id').references(() => users.id).notNull(),
  entityType: varchar('entity_type', { length: 30 }).notNull(),
  entityId: uuid('entity_id').notNull(),
  fileName: varchar('file_name', { length: 300 }).notNull(),
  storagePath: text('storage_path').notNull(),
  mimeType: varchar('mime_type', { length: 100 }).notNull(),
  sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
  ...timestamps,
  ...softDelete,
})
```

- [ ] **Step 4: Implementar `src/modules/ai/schema.ts`**

```ts
import { boolean, integer, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { idPk } from '@/db/columns'
import { organizations } from '@/modules/organization/schema'
import { users } from '@/modules/auth/schema'

/** Cost/reliability log for every AI call (spec §6). */
export const aiUsage = pgTable('ai_usage', {
  id: idPk(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  feature: varchar('feature', { length: 40 }).notNull(),
  provider: varchar('provider', { length: 40 }).notNull(),
  model: varchar('model', { length: 80 }).notNull(),
  inputTokens: integer('input_tokens').default(0).notNull(),
  outputTokens: integer('output_tokens').default(0).notNull(),
  success: boolean('success').notNull(),
  error: text('error'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})
```

- [ ] **Step 5: Registrar en el barril y generar migración**

En `src/db/schema.ts` agregar:

```ts
export * from '@/modules/collaboration/schema'
export * from '@/modules/ai/schema'
```

Run: `npm run db:generate`
Expected: nueva migración con `comments`, `activity_log`, `notifications`, `attachments`, `ai_usage`.

- [ ] **Step 6: Correr los tests y verificar que pasan**

Run: `npm test`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/modules/collaboration/ src/modules/ai/ src/db/schema.ts drizzle/
git commit -m "feat: add collaboration and AI usage schema"
```

---

### Task 9: Seed idempotente (organización, admin, catálogos de estados)

**Files:**
- Create: `src/db/seed.ts`, `src/db/seed.test.ts`, `scripts/seed.ts`
- Modify: `package.json` (script `db:seed`)

**Interfaces:**
- Consumes: `createTestDb`, `STATUS_CATALOGS`, tablas de Tasks 4-5, `hashPassword` **de Task 10** — ver nota
- Produces: `seed(db: Db, opts: SeedOptions): Promise<void>` y comando `npm run db:seed`

**Nota de orden:** este task usa `hashPassword` de `@/modules/auth/password`. Si se ejecuta el plan en orden, implementar **Task 10 antes que Task 9** o dejar el Step 6 (corrida real) para después de Task 10. Los steps de abajo asumen que Task 10 ya existe. *(Se listan en este orden porque el seed cierra la capa de datos, pero la dependencia real es Task 10 → Task 9.)*

- [ ] **Step 1: Escribir el test que falla — `src/db/seed.test.ts`**

```ts
import { beforeAll, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import type { Db } from '@/db'
import { createTestDb } from '@/test/db'
import { seed } from './seed'
import { organizations } from '@/modules/organization/schema'
import { users } from '@/modules/auth/schema'
import { customStatuses } from '@/modules/customization/schema'
import { STATUS_CATALOGS } from '@/modules/customization/catalogs'

const OPTS = { orgName: 'iU Corp', adminEmail: 'admin@test.com', adminPassword: 'secret123', adminName: 'Admin' }

describe('seed', () => {
  let db: Db

  beforeAll(async () => {
    db = await createTestDb()
  })

  it('creates org, admin and full status catalogs', async () => {
    await seed(db, OPTS)
    expect(await db.select().from(organizations)).toHaveLength(1)
    const admins = await db.select().from(users).where(eq(users.email, 'admin@test.com'))
    expect(admins).toHaveLength(1)
    expect(admins[0].role).toBe('admin')
    expect(admins[0].passwordHash).not.toBe('secret123') // stored hashed
    expect(await db.select().from(customStatuses)).toHaveLength(STATUS_CATALOGS.length)
  })

  it('is idempotent: running twice changes nothing', async () => {
    await seed(db, OPTS)
    expect(await db.select().from(organizations)).toHaveLength(1)
    expect(await db.select().from(users)).toHaveLength(1)
    expect(await db.select().from(customStatuses)).toHaveLength(STATUS_CATALOGS.length)
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npm test`
Expected: FAIL — `./seed` no existe.

- [ ] **Step 3: Implementar `src/db/seed.ts`**

```ts
import { and, eq } from 'drizzle-orm'
import type { Db } from '@/db'
import { organizations } from '@/modules/organization/schema'
import { users } from '@/modules/auth/schema'
import { customStatuses } from '@/modules/customization/schema'
import { STATUS_CATALOGS } from '@/modules/customization/catalogs'
import { hashPassword } from '@/modules/auth/password'

export interface SeedOptions {
  orgName: string
  adminEmail: string
  adminPassword: string
  adminName: string
}

/** Idempotent bootstrap: single org, one admin, def-§5.2 status catalogs. Safe to re-run. */
export async function seed(db: Db, opts: SeedOptions): Promise<void> {
  let [org] = await db.select().from(organizations).where(eq(organizations.name, opts.orgName))
  if (!org) {
    ;[org] = await db.insert(organizations).values({ name: opts.orgName }).returning()
  }

  const existingAdmin = await db.select().from(users).where(eq(users.email, opts.adminEmail))
  if (existingAdmin.length === 0) {
    await db.insert(users).values({
      organizationId: org.id,
      name: opts.adminName,
      email: opts.adminEmail,
      passwordHash: await hashPassword(opts.adminPassword),
      role: 'admin',
    })
  }

  for (const status of STATUS_CATALOGS) {
    const existing = await db
      .select()
      .from(customStatuses)
      .where(
        and(
          eq(customStatuses.organizationId, org.id),
          eq(customStatuses.entityType, status.entityType),
          eq(customStatuses.name, status.name),
        ),
      )
    if (existing.length === 0) {
      await db.insert(customStatuses).values({ organizationId: org.id, ...status })
    }
  }
}
```

- [ ] **Step 4: Crear el CLI `scripts/seed.ts`**

```ts
import 'dotenv/config'
import { db } from '@/db'
import { seed } from '@/db/seed'

const required = (name: string): string => {
  const value = process.env[name]
  if (!value) throw new Error(`Missing env var ${name}`)
  return value
}

await seed(db, {
  orgName: required('SEED_ORG_NAME'),
  adminEmail: required('SEED_ADMIN_EMAIL'),
  adminPassword: required('SEED_ADMIN_PASSWORD'),
  adminName: required('SEED_ADMIN_NAME'),
})
console.log('Seed completed.')
process.exit(0)
```

Instalar tsx y agregar el script:

```bash
npm i -D tsx
```

En `package.json`:

```json
"db:seed": "tsx scripts/seed.ts"
```

- [ ] **Step 5: Correr los tests y verificar que pasan**

Run: `npm test`
Expected: PASS

- [ ] **Step 6: Migrar y sembrar la BD real de Supabase**

Con `.env` configurado (Task 3):

```bash
npm run db:migrate
npm run db:seed
```

Expected: `Seed completed.` — verificar en el dashboard de Supabase (Table Editor) que existen la organización, el admin y los estados.

- [ ] **Step 7: Commit**

```bash
git add src/db/seed.ts src/db/seed.test.ts scripts/ package.json package-lock.json
git commit -m "feat: add idempotent seed for org, admin and status catalogs"
```

---

### Task 10: Hash de contraseñas y verificación de credenciales

**Files:**
- Create: `src/modules/auth/password.ts`, `src/modules/auth/password.test.ts`, `src/modules/auth/service.ts`, `src/modules/auth/service.test.ts`

**Interfaces:**
- Consumes: `users` schema (Task 4), `createTestDb` (Task 4)
- Produces:
  - `hashPassword(plain: string): Promise<string>` y `verifyPassword(plain: string, hash: string): Promise<boolean>` en `@/modules/auth/password`
  - `verifyCredentials(db: Db, email: string, password: string): Promise<AuthUser | null>` en `@/modules/auth/service`, donde `AuthUser = { id: string; name: string; email: string; role: 'admin' | 'member'; organizationId: string }`

- [ ] **Step 1: Instalar bcryptjs**

```bash
npm i bcryptjs
```

(bcryptjs es JS puro — sin binarios nativos que compliquen Windows/Vercel. Desde v3 incluye sus propios tipos.)

- [ ] **Step 2: Escribir tests que fallan — `src/modules/auth/password.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import { hashPassword, verifyPassword } from './password'

describe('password hashing', () => {
  it('verifies a correct password against its hash', async () => {
    const hash = await hashPassword('s3cure-pass')
    expect(hash).not.toContain('s3cure-pass')
    expect(await verifyPassword('s3cure-pass', hash)).toBe(true)
  })

  it('rejects a wrong password', async () => {
    const hash = await hashPassword('s3cure-pass')
    expect(await verifyPassword('wrong', hash)).toBe(false)
  })
})
```

- [ ] **Step 3: Correr y verificar que falla**

Run: `npm test`
Expected: FAIL — `./password` no existe.

- [ ] **Step 4: Implementar `src/modules/auth/password.ts`**

```ts
import bcrypt from 'bcryptjs'

const ROUNDS = 12

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS)
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}
```

Run: `npm test` → PASS.

- [ ] **Step 5: Escribir tests que fallan — `src/modules/auth/service.test.ts`**

```ts
import { beforeAll, describe, expect, it } from 'vitest'
import type { Db } from '@/db'
import { createTestDb } from '@/test/db'
import { organizations } from '@/modules/organization/schema'
import { users } from '@/modules/auth/schema'
import { hashPassword } from './password'
import { verifyCredentials } from './service'

describe('verifyCredentials', () => {
  let db: Db

  beforeAll(async () => {
    db = await createTestDb()
    const [org] = await db.insert(organizations).values({ name: 'Org' }).returning()
    await db.insert(users).values([
      { organizationId: org.id, name: 'Ana', email: 'ana@x.com', passwordHash: await hashPassword('correct'), role: 'admin' },
      { organizationId: org.id, name: 'Out', email: 'out@x.com', passwordHash: await hashPassword('correct'), isActive: false },
    ])
  })

  it('returns the user for valid credentials', async () => {
    const user = await verifyCredentials(db, 'ana@x.com', 'correct')
    expect(user).toMatchObject({ email: 'ana@x.com', role: 'admin' })
    expect(user).not.toHaveProperty('passwordHash')
  })

  it('returns null for a wrong password', async () => {
    expect(await verifyCredentials(db, 'ana@x.com', 'nope')).toBeNull()
  })

  it('returns null for an unknown email', async () => {
    expect(await verifyCredentials(db, 'ghost@x.com', 'correct')).toBeNull()
  })

  it('returns null for an inactive user', async () => {
    expect(await verifyCredentials(db, 'out@x.com', 'correct')).toBeNull()
  })
})
```

- [ ] **Step 6: Correr y verificar que falla**

Run: `npm test`
Expected: FAIL — `./service` no existe.

- [ ] **Step 7: Implementar `src/modules/auth/service.ts`**

```ts
import { eq } from 'drizzle-orm'
import type { Db } from '@/db'
import { users } from './schema'
import { verifyPassword } from './password'

export interface AuthUser {
  id: string
  name: string
  email: string
  role: 'admin' | 'member'
  organizationId: string
}

/** Business rule: only active, non-deleted users may sign in. Never leaks the hash. */
export async function verifyCredentials(db: Db, email: string, password: string): Promise<AuthUser | null> {
  const [user] = await db.select().from(users).where(eq(users.email, email))
  if (!user || !user.isActive || user.deletedAt) return null
  const valid = await verifyPassword(password, user.passwordHash)
  if (!valid) return null
  return { id: user.id, name: user.name, email: user.email, role: user.role, organizationId: user.organizationId }
}
```

- [ ] **Step 8: Correr los tests y verificar que pasan**

Run: `npm test`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/modules/auth/ package.json package-lock.json
git commit -m "feat: add password hashing and credential verification"
```

---

### Task 11: Auth.js — login, sesión JWT y middleware

**Files:**
- Create: `src/auth.config.ts`, `src/auth.ts`, `src/middleware.ts`, `src/types/next-auth.d.ts`, `src/app/api/auth/[...nextauth]/route.ts`, `src/app/login/page.tsx`
- Modify: `src/app/page.tsx`, `src/app/layout.tsx`

**Interfaces:**
- Consumes: `verifyCredentials` y `AuthUser` (Task 10), `db` (Task 3)
- Produces: `auth()`, `signIn()`, `signOut()`, `handlers` desde `@/auth`; toda ruta salvo `/login` exige sesión; `session.user` expone `id`, `role`, `organizationId`

- [ ] **Step 1: Instalar Auth.js y generar el secreto**

```bash
npm i next-auth@beta
npx auth secret
```

(`npx auth secret` escribe `AUTH_SECRET` en `.env.local`; copiar el valor a `.env` si se usa ese archivo.)

- [ ] **Step 2: Crear `src/types/next-auth.d.ts`** (augmentación de tipos)

```ts
import type { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface User {
    role: 'admin' | 'member'
    organizationId: string
  }
  interface Session {
    user: DefaultSession['user'] & {
      id: string
      role: 'admin' | 'member'
      organizationId: string
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    role: 'admin' | 'member'
    organizationId: string
  }
}
```

- [ ] **Step 3: Crear `src/auth.config.ts`** (config sin BD, segura para middleware/edge)

```ts
import type { NextAuthConfig } from 'next-auth'

export const authConfig = {
  pages: { signIn: '/login' },
  session: { strategy: 'jwt' },
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user
      if (request.nextUrl.pathname.startsWith('/login')) return true
      return isLoggedIn
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string
        token.role = user.role
        token.organizationId = user.organizationId
      }
      return token
    },
    session({ session, token }) {
      session.user.id = token.id
      session.user.role = token.role
      session.user.organizationId = token.organizationId
      return session
    },
  },
  providers: [], // filled in auth.ts (needs DB access, not edge-safe)
} satisfies NextAuthConfig
```

- [ ] **Step 4: Crear `src/auth.ts`**

```ts
import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { z } from 'zod'
import { authConfig } from '@/auth.config'
import { db } from '@/db'
import { verifyCredentials } from '@/modules/auth/service'

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials)
        if (!parsed.success) return null
        return verifyCredentials(db, parsed.data.email, parsed.data.password)
      },
    }),
  ],
})
```

- [ ] **Step 5: Crear `src/middleware.ts` y el route handler**

`src/middleware.ts`:

```ts
import NextAuth from 'next-auth'
import { authConfig } from '@/auth.config'

export default NextAuth(authConfig).auth

export const config = {
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico).*)'],
}
```

`src/app/api/auth/[...nextauth]/route.ts`:

```ts
import { handlers } from '@/auth'

export const { GET, POST } = handlers
```

- [ ] **Step 6: Crear `src/app/login/page.tsx`** (UI en español)

```tsx
import { redirect } from 'next/navigation'
import { AuthError } from 'next-auth'
import { auth, signIn } from '@/auth'

async function login(formData: FormData) {
  'use server'
  try {
    await signIn('credentials', {
      email: formData.get('email'),
      password: formData.get('password'),
      redirectTo: '/',
    })
  } catch (error) {
    if (error instanceof AuthError) redirect('/login?error=1')
    throw error
  }
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const session = await auth()
  if (session) redirect('/')
  const { error } = await searchParams

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50">
      <form action={login} className="w-full max-w-sm space-y-4 rounded-lg bg-white p-8 shadow">
        <h1 className="text-xl font-semibold">P-ERP — Iniciar sesión</h1>
        {error && (
          <p className="rounded bg-red-50 p-2 text-sm text-red-700">
            Correo o contraseña incorrectos.
          </p>
        )}
        <label className="block text-sm">
          Correo electrónico
          <input name="email" type="email" required autoComplete="email"
            className="mt-1 w-full rounded border px-3 py-2" />
        </label>
        <label className="block text-sm">
          Contraseña
          <input name="password" type="password" required autoComplete="current-password"
            className="mt-1 w-full rounded border px-3 py-2" />
        </label>
        <button type="submit" className="w-full rounded bg-gray-900 py-2 text-white hover:bg-gray-700">
          Entrar
        </button>
      </form>
    </main>
  )
}
```

- [ ] **Step 7: Reemplazar `src/app/page.tsx`** (home protegido con datos de sesión y logout)

```tsx
import { auth, signOut } from '@/auth'

export default async function HomePage() {
  const session = await auth()

  return (
    <main className="mx-auto max-w-3xl p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">P-ERP</h1>
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
      </div>
      <p className="mt-6 text-gray-600">
        Sesión iniciada como <strong>{session?.user.name}</strong> ({session?.user.role}).
      </p>
      <p className="mt-2 text-sm text-gray-400">Iteración 0 — fundación. Los módulos llegan en la iteración 1.</p>
    </main>
  )
}
```

En `src/app/layout.tsx`, ajustar metadata:

```tsx
export const metadata: Metadata = {
  title: 'P-ERP',
  description: 'Gestión inteligente de proyectos y operación',
}
```

y `<html lang="es">`.

- [ ] **Step 8: Verificación manual del flujo completo**

Run: `npm run dev`
En el navegador:
1. Abrir `http://localhost:3000/` → redirige a `/login`.
2. Credenciales incorrectas → mensaje "Correo o contraseña incorrectos."
3. Credenciales del seed (`SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`) → entra al home y muestra nombre y rol.
4. "Cerrar sesión" → regresa a `/login`; volver a `/` redirige a `/login`.

Expected: los 4 pasos se comportan como se describe.

- [ ] **Step 9: Lint, typecheck, tests y commit**

Run: `npm run lint && npm run typecheck && npm test`
Expected: sin errores.

```bash
git add src/auth.config.ts src/auth.ts src/middleware.ts src/types/ src/app/ package.json package-lock.json
git commit -m "feat: add Auth.js credentials login with JWT sessions"
```

---

### Task 12: Playwright — smoke E2E del login

**Files:**
- Create: `playwright.config.ts`, `e2e/login.spec.ts`
- Modify: `package.json` (script `test:e2e`), `.gitignore`

**Interfaces:**
- Consumes: app de Task 11 corriendo con la BD sembrada (Task 9)
- Produces: `npm run test:e2e` — corre localmente contra `.env`; **no** corre en CI en esta iteración (requiere BD real)

- [ ] **Step 1: Instalar Playwright**

```bash
npm i -D @playwright/test
npx playwright install chromium
```

Agregar a `.gitignore`:

```
/test-results/
/playwright-report/
```

Agregar script a `package.json`:

```json
"test:e2e": "playwright test"
```

- [ ] **Step 2: Crear `playwright.config.ts`**

```ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://localhost:3000' },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000/login',
    reuseExistingServer: true,
  },
})
```

- [ ] **Step 3: Escribir `e2e/login.spec.ts`**

```ts
import { expect, test } from '@playwright/test'

// Requires a seeded database (npm run db:seed) and SEED_ADMIN_* in .env.
const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@example.com'
const password = process.env.SEED_ADMIN_PASSWORD ?? 'changeme'

test('redirects anonymous users to /login', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/login/)
})

test('rejects wrong credentials', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Correo electrónico').fill(email)
  await page.getByLabel('Contraseña').fill('wrong-password')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByText('Correo o contraseña incorrectos.')).toBeVisible()
})

test('signs in and out with seeded admin', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Correo electrónico').fill(email)
  await page.getByLabel('Contraseña').fill(password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByText('Sesión iniciada como')).toBeVisible()
  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await expect(page).toHaveURL(/\/login/)
})
```

Playwright no carga `.env` por sí solo — agregar como primera línea de `playwright.config.ts`:

```ts
import 'dotenv/config'
```

- [ ] **Step 4: Correr y verificar**

Run: `npm run test:e2e`
Expected: 3 tests PASS (con `.env` configurado y BD sembrada).

- [ ] **Step 5: Commit**

```bash
git add playwright.config.ts e2e/ package.json package-lock.json .gitignore
git commit -m "test: add Playwright login smoke tests"
```

---

### Task 13: Repositorio remoto y CI (GitHub Actions)

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: scripts `lint`, `typecheck`, `test` (Tasks 1-2)
- Produces: CI que corre en cada push/PR. Los tests usan PGlite — **CI no necesita secretos ni BD**.

**⚠️ Requiere al usuario:** confirmar el nombre y visibilidad del repo en GitHub antes de crearlo.

- [ ] **Step 1: Crear el repo remoto (pedir confirmación al usuario primero)**

```bash
gh repo create iu-erp --private --source . --push
```

(Ajustar nombre/organización según lo que confirme el usuario. Nota: la rama por defecto local es `master`; si el usuario prefiere `main`, renombrar antes con `git branch -m master main`.)

- [ ] **Step 2: Crear `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [master]
  pull_request:

jobs:
  checks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test
```

- [ ] **Step 3: Commit y push de la rama**

```bash
git add .github/
git commit -m "ci: add lint, typecheck and test workflow"
git push -u origin feat/iteration-0-foundation
```

- [ ] **Step 4: Verificar CI en verde**

Run: `gh run watch` (o revisar la pestaña Actions)
Expected: workflow `CI` en verde para la rama.

---

### Task 14: CLAUDE.md e instrucciones de git operativas

**Files:**
- Create: `CLAUDE.md`
- Modify: `docs/mios/instruccionesGit.md` (solo reemplazar los `<placeholders>`, como indica el propio archivo)

**Interfaces:**
- Consumes: comandos reales del proyecto (Tasks 1-2, 12)
- Produces: contexto de proyecto cargado en cada sesión de Claude Code

- [ ] **Step 1: Crear `CLAUDE.md`**

```markdown
# P-ERP — Gestión inteligente de proyectos y operación

ERP web para administrar clientes, proyectos, subproyectos, hitos, tareas,
horas facturables y comunicación operativa, con capa de IA. MVP 1 en construcción.

## Documentos clave

- Definición funcional: docs/mios/definicionMVP1.md
- Diseño técnico: docs/superpowers/specs/2026-07-28-p-erp-mvp1-tech-design.md
- Git workflow: @docs/mios/instruccionesGit.md

## Stack

Next.js (App Router) + TypeScript estricto · Drizzle ORM + PostgreSQL (Supabase) ·
Auth.js · Tailwind + shadcn/ui · Vitest (unit/integración con PGlite) · Playwright (E2E).

## Comandos

- `npm test` — unit + integración (PGlite, no requiere BD)
- `npm run lint && npm run typecheck` — obligatorios antes de cada commit
- `npm run test:e2e` — E2E local (requiere .env y BD sembrada)
- `npm run db:generate` / `db:migrate` / `db:seed` — ciclo de esquema

## Reglas del proyecto

- UI y datos en español; código, identificadores y commits en inglés.
- Toda tabla de negocio lleva organization_id; ninguna consulta sin ese filtro.
- Reglas de negocio en src/modules/*/service.ts — nunca en componentes React.
- Soft delete (deleted_at) en entidades de negocio; nunca DELETE físico.
- Totales de horas siempre calculados en consultas; sin contadores duplicados.
```

- [ ] **Step 2: Reemplazar placeholders en `docs/mios/instruccionesGit.md`**

En la línea de tests, sustituir `<comando de tests>` por `npm test` y `<comando de lint/typecheck>` por `npm run lint && npm run typecheck`. No tocar nada más del archivo.

- [ ] **Step 3: Verificar y commitear**

Run: `npm run lint && npm run typecheck && npm test`
Expected: sin errores.

```bash
git add CLAUDE.md docs/mios/instruccionesGit.md
git commit -m "docs: add CLAUDE.md and wire git workflow commands"
```

---

### Task 15: Deploy a Vercel y cierre de la iteración

**Files:**
- Ninguno nuevo (configuración en dashboards)

**Interfaces:**
- Consumes: repo en GitHub (Task 13), proyecto Supabase (Task 3)
- Produces: URL de producción con login funcionando — el entregable de la Iteración 0 (spec §9)

**⚠️ Requiere al usuario:** cuenta de Vercel y acceso al dashboard. Los pasos 1-3 los hace el usuario guiado; pausar y dar instrucciones.

- [ ] **Step 1 (usuario): Importar el repo en Vercel**

En vercel.com → Add New → Project → importar `iu-erp` desde GitHub. Framework preset: Next.js (autodetectado). No hacer deploy todavía.

- [ ] **Step 2 (usuario): Configurar variables de entorno en Vercel**

En Project Settings → Environment Variables agregar:
- `DATABASE_URL` — el connection string transaction pooler de Supabase
- `AUTH_SECRET` — generar uno nuevo para producción (`openssl rand -base64 32`); no reutilizar el de desarrollo
- `AUTH_TRUST_HOST` = `true`

- [ ] **Step 3 (usuario): Deploy**

Trigger deploy desde el dashboard (o `git push` a la rama conectada). Esperar build verde.

- [ ] **Step 4: Verificación de producción**

En la URL de producción repetir la verificación manual de Task 11 Step 8 (redirect a login, credenciales malas rechazadas, login del admin, logout).
Expected: los 4 pasos funcionan en producción.

- [ ] **Step 5: Abrir el PR de la iteración**

Según `docs/mios/instruccionesGit.md`: mostrar `git diff master...feat/iteration-0-foundation --stat` al usuario, correr `/code-review` sobre el diff, reportar hallazgos de corrección, y entonces:

```bash
gh pr create --title "Iteration 0: foundation" --body "$(cat <<'EOF'
## Qué cambia
Scaffold Next.js + TypeScript estricto, esquema completo de BD (Drizzle + Supabase),
seed idempotente (org, admin, catálogos de estados), autenticación con Auth.js,
tests (Vitest + PGlite, Playwright) y CI.

## Por qué
Iteración 0 del plan docs/superpowers/plans/2026-07-28-iteracion-0-fundacion.md:
la fundación sobre la que se construyen las iteraciones 1-5 del MVP.

## Cómo verificarlo
- npm run lint && npm run typecheck && npm test
- npm run test:e2e (requiere .env y BD sembrada)
- Login en la URL de producción con las credenciales del seed

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 6: Cierre**

Tras merge del PR: la Iteración 0 está completa. Siguiente paso: plan de la **Iteración 1 — Núcleo P1a** (CRUD de clientes → proyectos → subproyectos → hitos → tareas) con la skill writing-plans.

---

## Orden de ejecución recomendado

Dependencia real entre tasks: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → **10 → 9** → 11 → 12 → 13 → 14 → 15 (el seed usa `hashPassword` de Task 10; ver nota en Task 9).

## Verificación final de la iteración (checklist del entregable, spec §9)

- [ ] `npm run lint && npm run typecheck && npm test` en verde local y en CI
- [ ] Esquema completo en Supabase (18 tablas) con migraciones versionadas en `drizzle/`
- [ ] Seed idempotente ejecutado: organización, admin y catálogos de def-§5.2
- [ ] Login/logout funcionando en producción (Vercel)
- [ ] `CLAUDE.md` e instrucciones de git operativas sin placeholders
