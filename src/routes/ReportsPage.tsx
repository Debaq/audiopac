import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FileText, ChevronRight, ArrowUpDown, ChevronLeft, ChevronRight as ChevronRightIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SearchBar } from '@/components/ui/SearchBar'
import { FilterChips, type ChipOption } from '@/components/ui/FilterChips'
import { listAllSessions } from '@/lib/db/sessions'
import type { SessionWithDetails, SessionStatus } from '@/types'
import { formatDateTime, percent } from '@/lib/utils'

type StatusFilter = 'all' | SessionStatus
type SortKey = 'date_desc' | 'date_asc' | 'patient_asc' | 'test_asc' | 'score_desc'

const PAGE_SIZE = 25
const LOAD_LIMIT = 2000

function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
}

const SORT_LABELS: Record<SortKey, string> = {
  date_desc: 'Más recientes',
  date_asc: 'Más antiguas',
  patient_asc: 'Paciente (A–Z)',
  test_asc: 'Test (A–Z)',
  score_desc: 'Mayor puntaje',
}

export function ReportsPage() {
  const [sessions, setSessions] = useState<SessionWithDetails[]>([])
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sort, setSort] = useState<SortKey>('date_desc')
  const [page, setPage] = useState(1)

  useEffect(() => { listAllSessions(LOAD_LIMIT).then(setSessions) }, [])

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
    const rows = sessions.filter(s => {
      if (statusFilter !== 'all' && s.status !== statusFilter) return false
      if (!nq) return true
      return norm(s.patient_name).includes(nq)
        || norm(s.template_name).includes(nq)
        || norm(s.profile_name ?? '').includes(nq)
        || String(s.id) === query.trim()
    })
    const cmp: Record<SortKey, (a: SessionWithDetails, b: SessionWithDetails) => number> = {
      date_desc: (a, b) => (b.started_at ?? '').localeCompare(a.started_at ?? ''),
      date_asc: (a, b) => (a.started_at ?? '').localeCompare(b.started_at ?? ''),
      patient_asc: (a, b) => a.patient_name.localeCompare(b.patient_name),
      test_asc: (a, b) => a.template_name.localeCompare(b.template_name),
      score_desc: (a, b) => (b.test_score ?? -1) - (a.test_score ?? -1),
    }
    return [...rows].sort(cmp[sort])
  }, [sessions, query, statusFilter, sort])

  useEffect(() => { setPage(1) }, [query, statusFilter, sort])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageSafe = Math.min(page, totalPages)
  const pageItems = filtered.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE)

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Informes</h1>
        <p className="text-[var(--muted-foreground)]">
          {filtered.length} {filtered.length === sessions.length ? '' : `de ${sessions.length}`} evaluaciones
          {sessions.length >= LOAD_LIMIT && <span className="text-xs"> (mostrando últimas {LOAD_LIMIT})</span>}
        </p>
      </div>

      <div className="mb-4 space-y-3">
        <SearchBar
          value={query}
          onChange={setQuery}
          placeholder="Buscar por paciente, test, evaluador o ID..."
        />
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <FilterChips options={statusOptions} value={statusFilter} onChange={setStatusFilter} />
          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4 text-[var(--muted-foreground)]" />
            <select
              value={sort}
              onChange={e => setSort(e.target.value as SortKey)}
              className="text-sm bg-[var(--card)] border border-[var(--border)] rounded-md px-2 py-1.5"
            >
              {(Object.keys(SORT_LABELS) as SortKey[]).map(k => (
                <option key={k} value={k}>{SORT_LABELS[k]}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="py-16 text-center">
          <FileText className="w-12 h-12 mx-auto text-[var(--muted-foreground)] mb-3" />
          <p className="text-[var(--muted-foreground)]">
            {sessions.length === 0 ? 'Sin evaluaciones aún' : 'Sin coincidencias'}
          </p>
        </CardContent></Card>
      ) : (
        <>
          <div className="space-y-2">
            {pageItems.map(s => (
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

          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between">
              <div className="text-xs text-[var(--muted-foreground)]">
                Página {pageSafe} de {totalPages} · mostrando {pageItems.length} de {filtered.length}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline" size="sm"
                  disabled={pageSafe <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="w-4 h-4" /> Anterior
                </Button>
                <Button
                  variant="outline" size="sm"
                  disabled={pageSafe >= totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                >
                  Siguiente <ChevronRightIcon className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
