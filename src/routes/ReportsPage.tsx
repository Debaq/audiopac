import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FileText, ChevronRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { SearchBar } from '@/components/ui/SearchBar'
import { FilterChips, type ChipOption } from '@/components/ui/FilterChips'
import { listAllSessions } from '@/lib/db/sessions'
import type { SessionWithDetails, SessionStatus } from '@/types'
import { formatDateTime, percent } from '@/lib/utils'

type StatusFilter = 'all' | SessionStatus

function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
}

export function ReportsPage() {
  const [sessions, setSessions] = useState<SessionWithDetails[]>([])
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  useEffect(() => { listAllSessions(500).then(setSessions) }, [])

  const counts = useMemo(() => {
    const m: Record<string, number> = { all: sessions.length, completed: 0, in_progress: 0, cancelled: 0 }
    for (const s of sessions) m[s.status] = (m[s.status] ?? 0) + 1
    return m
  }, [sessions])

  const statusOptions: ChipOption<StatusFilter>[] = [
    { value: 'all', label: 'Todos', count: counts.all },
    { value: 'completed', label: 'Completados', count: counts.completed },
    { value: 'in_progress', label: 'En curso', count: counts.in_progress },
    { value: 'cancelled', label: 'Cancelados', count: counts.cancelled },
  ]

  const filtered = useMemo(() => {
    const nq = query.trim() ? norm(query.trim()) : ''
    return sessions.filter(s => {
      if (statusFilter !== 'all' && s.status !== statusFilter) return false
      if (!nq) return true
      return norm(s.patient_name).includes(nq)
        || norm(s.template_name).includes(nq)
        || norm(s.profile_name ?? '').includes(nq)
        || String(s.id) === query.trim()
    })
  }, [sessions, query, statusFilter])

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Informes</h1>
        <p className="text-[var(--muted-foreground)]">
          {filtered.length} {filtered.length === sessions.length ? '' : `de ${sessions.length}`} evaluaciones
        </p>
      </div>

      <div className="mb-4 space-y-3">
        <SearchBar
          value={query}
          onChange={setQuery}
          placeholder="Buscar por paciente, test, evaluador o ID..."
        />
        <FilterChips options={statusOptions} value={statusFilter} onChange={setStatusFilter} />
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="py-16 text-center">
          <FileText className="w-12 h-12 mx-auto text-[var(--muted-foreground)] mb-3" />
          <p className="text-[var(--muted-foreground)]">
            {sessions.length === 0 ? 'Sin evaluaciones aún' : 'Sin coincidencias'}
          </p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(s => (
            <Link key={s.id} to={`/informes/${s.id}`}>
              <Card className="hover:border-[var(--primary)] transition-colors">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{s.patient_name}</div>
                    <div className="text-sm text-[var(--muted-foreground)] truncate">
                      {s.template_name} • {formatDateTime(s.started_at)} • {s.profile_name}
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
