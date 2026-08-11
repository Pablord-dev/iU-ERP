import Link from 'next/link'
import { db } from '@/db'
import { requireCtx } from '@/lib/session'
import { listClients } from '@/modules/clients/service'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export default async function ClientsPage() {
  const ctx = await requireCtx()
  const rows = await listClients(db, ctx)
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Clientes</h1>
        <Button asChild><Link href="/clientes/nuevo">Nuevo cliente</Link></Button>
      </div>
      {rows.length === 0 ? (
        <p className="text-gray-500">Aún no hay clientes. Crea el primero.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre comercial</TableHead>
              <TableHead>Contacto</TableHead>
              <TableHead>Tarifa/h</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((c) => (
              <TableRow key={c.id}>
                <TableCell><Link className="font-medium hover:underline" href={`/clientes/${c.id}`}>{c.commercialName}</Link></TableCell>
                <TableCell>{c.contactName ?? '—'}</TableCell>
                <TableCell>{c.hourlyRate ? `$${c.hourlyRate}` : '—'}</TableCell>
                <TableCell><Badge variant={c.isActive ? 'default' : 'secondary'}>{c.isActive ? 'Activo' : 'Inactivo'}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
