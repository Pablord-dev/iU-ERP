import { auth, signOut } from '@/auth'

export default async function HomePage() {
  const session = await auth()

  return (
    <main className="mx-auto max-w-3xl p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">P-ERP</h1>
        <form
          action={async () => {
            'use server'
            await signOut({ redirectTo: '/login' })
          }}
        >
          <button type="submit" className="rounded border px-3 py-1 text-sm hover:bg-gray-100">
            Cerrar sesión
          </button>
        </form>
      </div>
      <p className="mt-6 text-gray-600">
        Sesión iniciada como <strong>{session?.user.name}</strong> ({session?.user.role}).
      </p>
      <p className="mt-2 text-sm text-gray-400">Iteración 0 — fundación. Los módulos llegan en la iteración 1.</p>
    </main>
  )
}
