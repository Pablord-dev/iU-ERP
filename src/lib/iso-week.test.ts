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
