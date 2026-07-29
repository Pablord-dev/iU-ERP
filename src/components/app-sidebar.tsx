'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const links = [
  { href: '/', label: 'Inicio' },
  { href: '/clientes', label: 'Clientes' },
  { href: '/proyectos', label: 'Proyectos' },
  { href: '/tareas', label: 'Tareas' },
  { href: '/configuracion/estados', label: 'Configuración' },
]

export function AppSidebar() {
  const pathname = usePathname()
  return (
    <nav className="flex w-56 shrink-0 flex-col gap-1 border-r bg-white p-4">
      <p className="mb-4 text-lg font-semibold">P-ERP</p>
      {links.map((l) => {
        const active = l.href === '/' ? pathname === '/' : pathname.startsWith(l.href.split('/').slice(0, 2).join('/'))
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`rounded px-3 py-2 text-sm ${active ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'}`}
          >
            {l.label}
          </Link>
        )
      })}
    </nav>
  )
}
