import Link from 'next/link'
import { db } from '@/db'
import { requireCtx } from '@/lib/session'
import { listProjects } from '@/modules/projects/service'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const PRIORITY_LABELS: Record<string, string> = { low: 'Baja', medium: 'Media', high: 'Alta', urgent: 'Urgente' }

export default async function ProjectsPage() {
  const ctx = await requireCtx()
  const rows = await listProjects(db, ctx)
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Proyectos</h1>
        <Button asChild><Link href="/proyectos/nuevo">Nuevo proyecto</Link></Button>
      </div>
      {rows.length === 0 ? (
        <p className="text-gray-500">Aún no hay proyectos.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Proyecto</TableHead><TableHead>Cliente</TableHead>
              <TableHead>Estado</TableHead><TableHead>Prioridad</TableHead><TableHead>Compromiso</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(({ project, clientName, status }) => (
              <TableRow key={project.id}>
                <TableCell><Link className="font-medium hover:underline" href={`/proyectos/${project.id}`}>{project.name}</Link></TableCell>
                <TableCell>{clientName}</TableCell>
                <TableCell><Badge style={status.color ? { backgroundColor: status.color } : undefined}>{status.name}</Badge></TableCell>
                <TableCell>{PRIORITY_LABELS[project.priority]}</TableCell>
                <TableCell>{project.dueDate ?? '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
