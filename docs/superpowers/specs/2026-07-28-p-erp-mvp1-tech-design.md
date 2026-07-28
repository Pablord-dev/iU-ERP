# P-ERP MVP 1.0 — Diseño técnico

| Campo | Detalle |
|---|---|
| Documento | Diseño técnico del MVP 1 |
| Base | [definicionMVP1.md](../../mios/definicionMVP1.md) (definición funcional cerrada) |
| Fecha | 28 de julio de 2026 |
| Estado | Aprobado por el usuario — listo para plan de implementación |

Este documento resuelve la validación técnica pendiente de la definición funcional: decide los puntos abiertos de §12, fija stack y arquitectura, y define modelo de datos, capa de IA, requerimientos no funcionales, estrategia de pruebas y orden de construcción. La definición funcional (módulos, alcance, criterios de aceptación) **no se repite aquí**; toda referencia `§n` apunta a `docs/mios/definicionMVP1.md`.

---

## 1. Decisiones tomadas sobre los puntos abiertos

| Punto | Decisión |
|---|---|
| §12.1 Personalización | Se sube a P1 el mínimo: estados personalizados por entidad + campos personalizados básicos. Vistas guardadas, filtros avanzados y el resto de tipos de campo quedan en P4. |
| §12.2 Organización | **Multi-tenant preparado**: existe la entidad Organización y todos los datos llevan `organization_id` desde el día uno, pero la app opera con una sola organización sembrada. Sin registro de organizaciones ni facturación SaaS en el MVP. |
| §12.3 Consolidación de horas | Dos conceptos explícitos: `budgeted_hours` (presupuesto capturado a mano en proyecto) vs. horas estimadas consolidadas (suma calculada de tareas). Las consolidaciones **se calculan en consultas, nunca se almacenan duplicadas**. |
| §12.4 Tarifa | `hourly_rate` en cliente (default) y en proyecto (sobrescribe). Importe estimado = horas facturables × tarifa vigente del proyecto. Tarifas por persona/rol quedan para una iteración futura. |
| §12.5 Aprobación vs. facturación | Un registro de horas solo puede pasar a "Pendiente de facturar" si su aprobación es "Aprobado", o si la organización tiene la aprobación desactivada (`require_time_approval`, default: off en el piloto). |
| §12.6 Migración desde Notion | **Captura manual asistida**: sin importador. Los proyectos activos se capturan a mano al arrancar el piloto, apoyándose en la función de IA "asistencia para crear tareas". |
| Proveedor de IA | **Abstracción propia** (`AIProvider`): el proveedor concreto (Anthropic, OpenAI, …) se decide por configuración y es intercambiable escribiendo un adaptador. |
| Hosting | Servicios administrados: **Vercel** (app) + **Supabase** (Postgres + storage de archivos). Presupuesto piloto ~$0–25 USD/mes. |

## 2. Stack

| Pieza | Elección | Nota |
|---|---|---|
| Framework | Next.js 15+ (App Router) | UI y API en un solo deploy |
| Lenguaje | TypeScript estricto | Tipado de la BD a la UI |
| Base de datos | PostgreSQL en Supabase | Administrado, respaldos diarios automáticos |
| Archivos | Supabase Storage | URLs firmadas y temporales, nunca públicas |
| ORM | Drizzle | Schema como código TS, migraciones versionadas en git |
| Auth | Auth.js — email + contraseña | La autenticación vive en la app, portable |
| UI | Tailwind CSS + shadcn/ui | Componentes accesibles listos, sin design system propio |
| Validación | Zod | Mismos esquemas en formularios y Server Actions |
| IA | Interfaz propia `AIProvider` | El sistema nunca importa un SDK de IA directamente |
| Tests | Vitest + Playwright | Ver §8 |

**Idioma:** UI y datos en español; código, identificadores y commits en inglés.

**Enfoques descartados:** backend/frontend separados (FastAPI + React SPA — dos lenguajes y dos deploys sin beneficio para un piloto de 1 usuario) y monolito server-rendered clásico (Laravel/Rails — la interactividad requerida terminaría exigiendo una capa JS paralela). Se eligió el monolito full-stack TypeScript por velocidad de iteración y una sola pieza que operar.

## 3. Arquitectura

```
Navegador (React)
   │
Next.js App Router  ←  UI + Server Actions/Route Handlers (API)
   │
Capa de dominio (src/modules/*)  ←  lógica de negocio pura, testeable
   │
Drizzle ORM → PostgreSQL (Supabase)     AIProvider → (Anthropic/OpenAI/…)
```

**Principio organizador:** código agrupado por dominio, no por capa técnica:

```
src/modules/
  auth/            Autenticación y sesiones (Auth.js)
  organization/    Configuración de la org (aprobación de horas, catálogos)
  clients/         §7.1 Clientes
  projects/        §7.2–7.4 Proyectos, subproyectos, hitos
  tasks/           §7.5 Tareas, responsables múltiples, vistas
  time/            §7.6–7.7 Registro de horas, aprobación, facturabilidad
  reports/         §7.8–7.9 Reporte semanal, carga de trabajo, exportación
  collaboration/   §8 Comentarios, menciones, actividad, notificaciones, feed
  customization/   §10 Estados, campos personalizados, etiquetas
  ai/              §9 Capa de IA (detrás de AIProvider)
  dashboard/       §11 Dashboard
```

Anatomía de cada módulo: `schema.ts` (tablas Drizzle), `service.ts` (lógica de negocio pura — aquí viven las reglas como aprobación→facturación), `actions.ts` (Server Actions que llaman al service) y componentes UI propios. **Las reglas de negocio nunca viven en componentes React.** Los módulos futuros del ERP (ventas, facturación, RH) se agregan como módulos nuevos sin tocar el núcleo.

## 4. Modelo de datos

```
organizations ─┬─ users
               ├─ clients ─── projects ─┬─ subprojects (opcional)
               │                        ├─ milestones ─── tasks ─┬─ task_assignees (N responsables)
               │                        │                        └─ time_entries
               │                        └─ (hitos/tareas directos si no hay subproyecto)
               ├─ comments / activity_log / notifications  (polimórficos)
               ├─ attachments (Supabase Storage)
               └─ custom_statuses / custom_fields / custom_field_values
```

Reglas del modelo:

1. **`organization_id` en toda tabla de datos.** Ninguna consulta existe sin filtro de organización.
2. **Jerarquía con subproyecto opcional:** `milestones.project_id` obligatorio, `milestones.subproject_id` opcional. `tasks.milestone_id` obligatorio.
3. **Horas:** `time_entries` es la única fuente de verdad del tiempo registrado; todos los totales (hito, subproyecto, proyecto, cliente, semana) son agregaciones calculadas.
4. **`time_entries` con doble máquina de estados:** `approval_status` (borrador → enviado → aprobado/rechazado) y `billing_status` (no facturable → pendiente de facturar → incluido en corte → facturado), conectadas por la regla de §12.5.
5. **Estados personalizados:** `custom_statuses` por entidad, con los catálogos de §5.2 sembrados como valores iniciales editables. Cada estado lleva una **categoría fija del sistema** (`open / in_progress / blocked / done / cancelled`) para que reportes, dashboard y Kanban funcionen sin importar cómo se renombren los estados.
6. **Campos personalizados:** `custom_fields` + `custom_field_values`, con los 8 tipos de §5.4 (en P1 solo los básicos; el resto en P4).
7. **Polimorfismo de contexto:** `comments`, `activity_log`, `notifications` y `attachments` usan `entity_type` + `entity_id` para ligarse a cualquier nivel de la jerarquía — cumple el pilar "todo comentario vive ligado a un elemento del sistema".
8. **Soft delete** (`deleted_at`) en entidades de negocio; nada se destruye por un clic equivocado.

## 5. Flujos de datos centrales

**① Registro de horas → reporte** (el flujo del criterio de éxito del piloto):

```
Usuario registra horas en una tarea (fecha, horas, descripción, ¿facturable?)
  → time_entries guarda el registro ligado a tarea + proyecto + cliente
  → totales por hito/subproyecto/proyecto/cliente calculados con agregaciones al momento
  → reporte semanal = agregación por semana ISO con filtros + export CSV
  → horas facturables × tarifa = importe estimado por cliente
```

**② Actividad → contexto unificado:**

```
Toda mutación relevante (crear tarea, cambiar estado, registrar horas, comentar)
  → escribe en activity_log vía el service correspondiente
  → alimenta: historial por entidad, feed interno, notificaciones por mención
```

**Vistas de tareas (§5.3):** una sola pantalla con modos **Lista** y **Kanban** (columnas = estados personalizados) y filtros componibles (responsable, proyecto, fecha, estado). "Mis tareas", "atrasadas" y "próximas a vencer" son presets de filtros, no pantallas separadas. Las vistas guardadas de P4 persisten esos mismos filtros con nombre.

**Dashboard (§11):** composición de consultas de los services de reportes — proyectos activos/en riesgo, hitos próximos, tareas atrasadas/bloqueadas, horas de la semana vs. anterior, actividad reciente. Sin infraestructura nueva.

## 6. Capa de inteligencia artificial

**Principio rector (§3):** si la IA se apaga, el producto sigue funcionando. El módulo `ai/` lee del sistema y propone; nunca es camino obligado de ningún flujo.

**Abstracción de proveedor:**

```ts
interface AIProvider {
  complete(request: {
    system: string
    messages: Message[]
    tools?: ToolDefinition[]   // para consultas que requieren leer datos
  }): Promise<AIResponse>
}
```

Un adaptador por proveedor; cuál se usa se decide por variable de entorno. Cambiar de proveedor = escribir un adaptador, cero cambios en las funciones de IA.

**Las cuatro funciones de §6:**

| Función | Mecánica |
|---|---|
| Resumen de proyecto | El sistema arma el contexto (árbol, horas, retrasos, comentarios) con consultas normales; el modelo solo redacta. |
| Resumen semanal | Agregaciones ya calculadas por `reports/` → el modelo redacta. |
| Consulta en lenguaje natural | El modelo recibe un catálogo de **herramientas de consulta predefinidas** (`get_hours_by_project`, `get_overdue_tasks`, `get_billable_hours_by_client`, …): funciones propias, tipadas, que siempre filtran por organización. La IA elige la herramienta; **nunca genera SQL ni toca la BD**. |
| Asistencia para crear tareas | El modelo devuelve una propuesta estructurada (validada con Zod) mostrada como borrador editable; **nada se guarda sin confirmación explícita del usuario**. |

**Control anti-alucinación (§12.9 — criterio de aceptación bloqueante):** las respuestas citan los datos usados (los resultados de las herramientas se muestran junto a la respuesta). Sin datos suficientes, el prompt del sistema obliga a responder "no hay información suficiente". Se valida con un set de evaluación basado en las preguntas de referencia de §6 contra datos sembrados conocidos, antes de dar por cumplido el criterio 15 de §10.

**Costo y degradación:** cada llamada registra tokens y resultado en la tabla `ai_usage`. Sin API key configurada, los botones de IA aparecen deshabilitados con aviso; el resto del sistema no se entera. Fallos del proveedor (timeout, caída) muestran "el asistente no está disponible" sin bloquear ninguna función.

## 7. Autenticación, no-funcionales y manejo de errores (§12.7)

- **Autenticación:** Auth.js, email + contraseña con hash fuerte, sesiones de larga duración en cookie segura. Sin registro público: el administrador crea usuarios (invitación con contraseña temporal). Roles mínimos: `admin` y `member`; permisos granulares fuera del MVP.
- **Respaldos:** diarios automáticos de Supabase + export semanal `pg_dump` como respaldo frío fuera del proveedor. El procedimiento de restauración se documenta y **se prueba una vez antes del piloto**.
- **Auditoría:** `activity_log` cumple doble función (colaboración + auditoría): quién, qué, cuándo y valores antes/después en JSON, para toda mutación de negocio. Nunca se borra.
- **Tiempos de respuesta (criterio verificable):** navegación y CRUD < 1 s; reportes y dashboard < 3 s; IA < 30 s con indicador de progreso.
- **Manejo de errores:**
  - Validación con Zod en cada frontera; mensajes en español ligados al campo, nunca un stack trace.
  - Reglas de negocio violadas → errores tipados de dominio lanzados por el service, traducidos por la UI a mensajes claros.
  - Errores inesperados → log server-side con contexto; el usuario ve pantalla genérica con folio. Logs de Vercel bastan en el piloto (sin Sentry).
- **Datos de clientes:** todo acceso requiere sesión; archivos con URLs firmadas temporales; HTTPS de extremo a extremo.

## 8. Estrategia de pruebas

Desarrollo con TDD. Comandos del proyecto: `npm test`, `npm run lint`, `npm run typecheck` (los que `docs/mios/instruccionesGit.md` exige correr antes de dar algo por terminado).

| Nivel | Herramienta | Qué cubre |
|---|---|---|
| Unitarias | Vitest | La capa de dominio (`service.ts`): consolidación de horas, regla aprobación→facturación, importes, semanas ISO, categorías de estados. Aquí vive la mayoría de las pruebas. |
| Integración | Vitest + Postgres de prueba | Consultas de reportes y agregaciones contra BD real, verificando el filtro de organización en todas. |
| E2E | Playwright | Solo los flujos de los 17 criterios de §10 — el flujo principal de §8 de punta a punta, no cada pantalla. |
| Evaluación de IA | Set propio | Preguntas de referencia de §6 contra datos sembrados; verifica la regla "solo datos del sistema". |

## 9. Orden de construcción

Respeta P1→P4 de §9, con la personalización mínima subida a P1 (§12.1):

| Iteración | Contenido | Resultado |
|---|---|---|
| **0. Fundación** | Repo, Next.js + Drizzle + Auth.js, CI básico, esquema completo de BD, seed de organización y estados | App desplegada en Vercel con login |
| **1. Núcleo P1a** | Clientes → proyectos → subproyectos → hitos → tareas (CRUD completo, multi-responsable, estados personalizados y campos personalizados básicos) | Se puede capturar toda la jerarquía |
| **2. Tiempo P1b** | Registro de horas, facturabilidad, tarifas, reporte semanal con export CSV, dashboard básico | Criterio de éxito central operable: horas facturables por cliente sin trabajo manual |
| **3. Colaboración P2** | Comentarios, actividad, menciones, notificaciones, adjuntos, aprobación opcional de horas, carga de trabajo | Versión simple (§12.8); lo profundo se valida en la etapa 2 del piloto |
| **4. IA P3** | AIProvider, resúmenes, consulta en lenguaje natural, asistente de tareas, evaluación anti-alucinación | Con datos reales de las iteraciones anteriores |
| **5. Personalización P4** | Campos personalizados restantes, vistas guardadas, filtros avanzados, pulido | Cierre del alcance MVP |

**El piloto puede arrancar al final de la iteración 2** — desde ahí ya sustituye a Notion para el flujo central; las iteraciones 3–5 llegan durante el piloto.

Cada iteración sigue el flujo de `docs/mios/instruccionesGit.md`: rama por tarea, commits pequeños, tests y lint antes de cerrar, PR con descripción. Al iniciar la iteración 0 se rellenan los `<placeholders>` de ese archivo con los comandos reales y se importa desde `CLAUDE.md`.

## 10. Fuera de alcance técnico

Además de las exclusiones funcionales de §7 de la definición: registro self-service de organizaciones, permisos granulares por rol, importadores de datos (Notion/CSV), monitoreo con Sentry, internacionalización (la UI es solo en español) y optimizaciones de escala más allá de los tiempos de respuesta de §7 de este documento.
