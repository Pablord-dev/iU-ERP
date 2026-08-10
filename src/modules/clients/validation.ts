import { z } from 'zod'
import { emptyToUndefined } from '@/lib/zod-utils'

const optionalText = (max: number) =>
  z.preprocess(emptyToUndefined, z.string().trim().max(max).optional())

export const clientInputSchema = z.object({
  commercialName: z.string().trim().min(1, 'El nombre comercial es obligatorio').max(200),
  legalName: optionalText(200),
  contactName: optionalText(200),
  email: z.preprocess(emptyToUndefined, z.string().email('Correo inválido').max(320).optional()),
  phone: optionalText(30),
  /** Default hourly rate (spec §12.4); form sends a string. */
  hourlyRate: z.preprocess(
    emptyToUndefined,
    z.coerce.number({ message: 'Debe ser un número' }).positive('Debe ser mayor a 0').optional(),
  ),
  notes: optionalText(5000),
  /** HTML checkbox: absent key means unchecked, so undefined must map to false (no .default). */
  isActive: z.preprocess((v) => v === 'on' || v === true, z.boolean()),
})

export type ClientInput = z.infer<typeof clientInputSchema>
