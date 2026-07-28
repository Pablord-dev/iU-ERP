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
