import { z } from 'zod'
import { emptyToUndefined } from '@/lib/zod-utils'

const optionalDate = z.preprocess(emptyToUndefined, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida').optional())
const optionalPositive = z.preprocess(
  emptyToUndefined,
  z.coerce.number({ message: 'Debe ser un número' }).positive('Debe ser mayor a 0').optional(),
)
const uuid = (msg: string) => z.string().uuid(msg)

export const projectInputSchema = z
  .object({
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
  // ISO dates compare correctly as strings, and an inverted range is a data-entry
  // slip the DB cannot catch: both columns are plain dates with no constraint.
  .refine((v) => !v.startDate || !v.dueDate || v.startDate <= v.dueDate, {
    message: 'La fecha de fin no puede ser anterior al inicio',
    path: ['dueDate'],
  })

export type ProjectInput = z.infer<typeof projectInputSchema>
