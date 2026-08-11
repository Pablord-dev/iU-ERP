import { describe, expect, it } from 'vitest'
import { projectInputSchema } from './validation'

const ID = '11111111-1111-4111-8111-111111111111'
const base = { clientId: ID, name: 'Sitio', responsibleId: ID }

describe('projectInputSchema', () => {
  it('applies defaults for priority and memberIds', () => {
    const parsed = projectInputSchema.parse(base)
    expect(parsed.priority).toBe('medium')
    expect(parsed.memberIds).toEqual([])
  })

  it('falls back to the default priority when the select sends an empty value', () => {
    expect(projectInputSchema.parse({ ...base, priority: '' }).priority).toBe('medium')
    expect(projectInputSchema.safeParse({ ...base, priority: 'urgente' }).success).toBe(false)
  })

  it('coerces numeric form strings and drops the empty optionals', () => {
    const parsed = projectInputSchema.parse({ ...base, budgetedHours: '120.5', hourlyRate: '', startDate: '' })
    expect(parsed.budgetedHours).toBe(120.5)
    expect(parsed.hourlyRate).toBeUndefined()
    expect(parsed.startDate).toBeUndefined()
    expect(projectInputSchema.safeParse({ ...base, budgetedHours: '0' }).success).toBe(false)
  })

  it('keeps the numbers inside what the numeric columns can hold', () => {
    // budgeted_hours es numeric(8,2) y hourly_rate numeric(10,2): sin cota, el INSERT
    // revienta con un error crudo de Postgres en vez de un mensaje de formulario.
    expect(projectInputSchema.safeParse({ ...base, budgetedHours: '999999.99' }).success).toBe(true)
    expect(projectInputSchema.safeParse({ ...base, budgetedHours: '1000000' }).success).toBe(false)
    expect(projectInputSchema.safeParse({ ...base, budgetedHours: '1e30' }).success).toBe(false)
    expect(projectInputSchema.safeParse({ ...base, hourlyRate: '99999999.99' }).success).toBe(true)
    expect(projectInputSchema.safeParse({ ...base, hourlyRate: '100000000' }).success).toBe(false)
  })

  it('rejects dates that do not exist in the calendar', () => {
    // El formato correcto no basta: la columna es date y Postgres rechaza el 30 de febrero.
    expect(projectInputSchema.safeParse({ ...base, startDate: '2026-02-30' }).success).toBe(false)
    expect(projectInputSchema.safeParse({ ...base, startDate: '2026-13-45' }).success).toBe(false)
    expect(projectInputSchema.safeParse({ ...base, dueDate: '2026-02-29' }).success).toBe(false)
    expect(projectInputSchema.safeParse({ ...base, dueDate: '2024-02-29' }).success).toBe(true)
  })

  it('drops duplicate memberIds so the join table primary key cannot blow up', () => {
    expect(projectInputSchema.parse({ ...base, memberIds: [ID, ID] }).memberIds).toEqual([ID])
  })

  it('rejects malformed dates and inverted ranges', () => {
    expect(projectInputSchema.safeParse({ ...base, startDate: '10-08-2026' }).success).toBe(false)
    const inverted = projectInputSchema.safeParse({ ...base, startDate: '2026-08-10', dueDate: '2026-08-01' })
    expect(inverted.success).toBe(false)
    expect(inverted.error?.issues[0].path).toEqual(['dueDate'])
    expect(projectInputSchema.safeParse({ ...base, startDate: '2026-08-01', dueDate: '2026-08-01' }).success).toBe(true)
  })

  it('requires a client, a responsible and a name', () => {
    expect(projectInputSchema.safeParse({ ...base, clientId: 'x' }).success).toBe(false)
    expect(projectInputSchema.safeParse({ ...base, responsibleId: 'x' }).success).toBe(false)
    expect(projectInputSchema.safeParse({ ...base, name: '   ' }).success).toBe(false)
  })
})
