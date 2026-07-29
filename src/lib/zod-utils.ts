import type { ZodError } from 'zod'

/** Map issues to { field: [messages] } without depending on flatten() shape. */
export function fieldErrorsOf(error: ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_root'
    ;(out[key] ??= []).push(issue.message)
  }
  return out
}

/** For optional form fields: '' → undefined so Zod optionals work with FormData. */
export const emptyToUndefined = (v: unknown) =>
  typeof v === 'string' && v.trim() === '' ? undefined : v
