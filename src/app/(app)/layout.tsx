import { Toaster } from '@/components/ui/sonner'
import { AppSidebar } from '@/components/app-sidebar'
import { requireCtx } from '@/lib/session'
import { signOut } from '@/auth'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { name } = await requireCtx()
  return (
    <div className="flex min-h-screen bg-gray-50">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-end gap-3 border-b bg-white px-6 py-3">
          <span className="text-sm text-gray-600">{name}</span>
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
        </header>
        <main className="min-w-0 flex-1 p-6">{children}</main>
      </div>
      <Toaster />
    </div>
  )
}
