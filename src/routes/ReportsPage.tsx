import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FileText, ChevronRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { listAllSessions } from '@/lib/db/sessions'
import type { SessionWithDetails } from '@/types'
import { formatDateTime, percent } from '@/lib/utils'

export function ReportsPage() {
  const [sessions, setSessions] = useState<SessionWithDetails[]>([])

  useEffect(() => { listAllSessions(500).then(setSessions) }, [])

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Informes</h1>
        <p className="text-[var(--muted-foreground)]">{sessions.length} evaluaciones registradas</p>
      </div>

      {sessions.length === 0 ? (
        <Card><CardContent className="py-16 text-center">
          <FileText className="w-12 h-12 mx-auto text-[var(--muted-foreground)] mb-3" />
          <p className="text-[var(--muted-foreground)]">Sin evaluaciones aún</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {sessions.map(s => (
            <Link key={s.id} to={`/informes/${s.id}`}>
              <Card className="hover:border-[var(--primary)] transition-colors">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="flex-1">
                    <div className="font-semibold">{s.patient_name}</div>
                    <div className="text-sm text-[var(--muted-foreground)]">
                      {s.template_name} • {formatDateTime(s.started_at)} • Evaluador: {s.profile_name}
                    </div>
                  </div>
                  <Badge variant={s.status === 'completed' ? 'success' : s.status === 'cancelled' ? 'destructive' : 'secondary'}>
                    {s.status === 'completed' ? 'Completado' : s.status === 'cancelled' ? 'Cancelado' : 'En curso'}
                  </Badge>
                  {s.test_score !== null && (
                    <div className="text-xl font-bold text-[var(--primary)] min-w-[70px] text-right">
                      {percent(s.test_score, 1)}%
                    </div>
                  )}
                  <ChevronRight className="w-5 h-5 text-[var(--muted-foreground)]" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
