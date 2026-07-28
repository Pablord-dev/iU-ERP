# P-ERP — Gestión inteligente de proyectos y operación

ERP web para administrar clientes, proyectos, subproyectos, hitos, tareas,
horas facturables y comunicación operativa, con capa de IA. MVP 1 en construcción.

## Documentos clave

- Definición funcional: docs/mios/definicionMVP1.md
- Diseño técnico: docs/superpowers/specs/2026-07-28-p-erp-mvp1-tech-design.md
- Git workflow: @docs/mios/instruccionesGit.md
- Reglas de Next.js 16 para agentes: @AGENTS.md

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
