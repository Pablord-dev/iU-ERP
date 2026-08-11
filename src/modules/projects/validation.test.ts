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

  it('coerces numeric form strings and drops the empty optionals', () => {
    const parsed = projectInputSchema.parse({ ...base, budgetedHours: '120.5', hourlyRate: '', startDate: '' })
    expect(parsed.budgetedHours).toBe(120.5)
    expect(parsed.hourlyRate).toBeUndefined()
    expect(parsed.startDate).toBeUndefined()
    expect(projectInputSchema.safeParse({ ...base, budgetedHours: '0' }).success).toBe(false)
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
