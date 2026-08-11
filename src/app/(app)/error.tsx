'use client'

import { Button } from '@/components/ui/button'

/** Catch-all boundary for uncaught errors from pages and Server Actions in the app shell. */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="text-2xl font-semibold">Algo salió mal</h1>
      <p className="mt-2 text-gray-500">
        Ocurrió un error inesperado. Intenta de nuevo; si el problema persiste, recarga la página.
      </p>
      {error.digest && <p className="mt-2 text-xs text-gray-400">Código: {error.digest}</p>}
      <Button className="mt-6" onClick={reset}>
        Reintentar
      </Button>
    </div>
  )
}
