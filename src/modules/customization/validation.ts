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
