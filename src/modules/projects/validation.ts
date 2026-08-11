import { z } from 'zod'
import { emptyToUndefined } from '@/lib/zod-utils'

/** `z.iso.date` valida el calendario real; un regex deja pasar el 30 de febrero y revienta en el INSERT. */
const optionalDate = z.preprocess(emptyToUndefined, z.iso.date({ message: 'Fecha inválida' }).optional())

/** `max` refleja la precisión de la columna: sin cota, Postgres responde con un error crudo. */
const optionalPositive = (max: number) =>
  z.preprocess(
    emptyToUndefined,
    z.coerce
      .number({ message: 'Debe ser un número' })
      .positive('Debe ser mayor a 0')
      .max(max, `No puede superar ${max}`)
      .optional(),
  )

const uuid = (msg: string) => z.string().uuid(msg)

export const projectInputSchema = z
  .object({
    clientId: uuid('Selecciona un cliente'),
    name: z.string().trim().min(1, 'El nombre es obligatorio').max(200, 'El nombre no puede pasar de 200 caracteres'),
    description: z.preprocess(emptyToUndefined, z.string().trim().max(5000, 'La descripción es demasiado larga').optional()),
    responsibleId: uuid('Selecciona un responsable'),
    statusId: z.preprocess(emptyToUndefined, z.string().uuid('Estado no válido').optional()),
    healthId: z.preprocess(emptyToUndefined, z.string().uuid('Estado no válido').optional()),
    // El preprocess deja que el placeholder vacío del select caiga en el default.
    priority: z.preprocess(
      emptyToUndefined,
      z.enum(['low', 'medium', 'high', 'urgent'], { message: 'Prioridad no válida' }).default('medium'),
    ),
    startDate: optionalDate,
    dueDate: optionalDate,
    /** Presupuesto manual (spec §12.3): no se calcula, se captura. Columna numeric(8,2). */
    budgetedHours: optionalPositive(999999.99),
    /** Sobrescribe la tarifa del cliente (spec §12.4). Columna numeric(10,2). */
    hourlyRate: optionalPositive(99999999.99),
    // Un <select multiple> no repite valores, pero un POST directo sí: duplicarlos
    // violaría la llave primaria de project_members.
    memberIds: z
      .array(z.string().uuid())
      .default([])
      .transform((ids) => [...new Set(ids)]),
  })
  // Las fechas ISO se comparan bien como texto, y un rango invertido es un desliz de
  // captura que la BD no puede detectar: ambas columnas son date sin constraint.
  .refine((v) => !v.startDate || !v.dueDate || v.startDate <= v.dueDate, {
    message: 'La fecha de fin no puede ser anterior al inicio',
    path: ['dueDate'],
  })

export type ProjectInput = z.infer<typeof projectInputSchema>
