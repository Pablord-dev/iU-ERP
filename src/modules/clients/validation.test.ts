import { describe, expect, it } from 'vitest'
import { clientInputSchema } from './validation'

describe('clientInputSchema', () => {
  it('maps checkbox semantics for isActive: absent → false, "on" → true', () => {
    const base = { commercialName: 'ACME' }
    expect(clientInputSchema.parse(base).isActive).toBe(false)
    expect(clientInputSchema.parse({ ...base, isActive: 'on' }).isActive).toBe(true)
    expect(clientInputSchema.parse({ ...base, isActive: true }).isActive).toBe(true)
  })

  it('coerces hourlyRate from form strings and rejects non-positive values', () => {
    const base = { commercialName: 'ACME', isActive: 'on' }
    expect(clientInputSchema.parse({ ...base, hourlyRate: '800.50' }).hourlyRate).toBe(800.5)
    expect(clientInputSchema.parse({ ...base, hourlyRate: '' }).hourlyRate).toBeUndefined()
    expect(clientInputSchema.safeParse({ ...base, hourlyRate: 'abc' }).success).toBe(false)
    expect(clientInputSchema.safeParse({ ...base, hourlyRate: '-5' }).success).toBe(false)
  })

  it('turns empty optional strings into undefined and requires commercialName', () => {
    const parsed = clientInputSchema.parse({ commercialName: 'ACME', email: '', legalName: '  ' })
    expect(parsed.email).toBeUndefined()
    expect(parsed.legalName).toBeUndefined()
    expect(clientInputSchema.safeParse({ commercialName: '   ' }).success).toBe(false)
  })
})
