import { redirect } from 'next/navigation'
import { AuthError } from 'next-auth'
import { auth, signIn } from '@/auth'

async function login(formData: FormData) {
  'use server'
  try {
    await signIn('credentials', {
      email: formData.get('email'),
      password: formData.get('password'),
      redirectTo: '/',
    })
  } catch (error) {
    if (error instanceof AuthError) redirect('/login?error=1')
    throw error
  }
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const session = await auth()
  if (session) redirect('/')
  const { error } = await searchParams

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50">
      <form action={login} className="w-full max-w-sm space-y-4 rounded-lg bg-white p-8 shadow">
        <h1 className="text-xl font-semibold">P-ERP — Iniciar sesión</h1>
        {error && (
          <p className="rounded bg-red-50 p-2 text-sm text-red-700">
            Correo o contraseña incorrectos.
          </p>
        )}
        <label className="block text-sm">
          Correo electrónico
          <input name="email" type="email" required autoComplete="email"
            className="mt-1 w-full rounded border px-3 py-2" />
        </label>
        <label className="block text-sm">
          Contraseña
          <input name="password" type="password" required autoComplete="current-password"
            className="mt-1 w-full rounded border px-3 py-2" />
        </label>
        <button type="submit" className="w-full rounded bg-gray-900 py-2 text-white hover:bg-gray-700">
          Entrar
        </button>
      </form>
    </main>
  )
}
