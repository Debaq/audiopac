import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Settings2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { SearchBar } from '@/components/ui/SearchBar'
import { FilterChips, type ChipOption } from '@/components/ui/FilterChips'
import { listTemplates, deleteTemplate } from '@/lib/db/templates'
import type { TestTemplateParsed, TestType } from '@/types'

type TypeFilter = 'all' | TestType
type StdFilter = 'all' | 'std' | 'custom'

function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
}

export function TestsPage() {
  const [templates, setTemplates] = useState<TestTemplateParsed[]>([])
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [stdFilter, setStdFilter] = useState<StdFilter>('all')

  const load = async () => setTemplates(await listTemplates(false))
  useEffect(() => { load() }, [])

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm('¿Eliminar este test? Solo se pueden eliminar tests personalizados.')) return
    await deleteTemplate(id)
    await load()
  }

  const typeCounts = useMemo(() => {
    const m: Record<string, number> = { all: templates.length }
    for (const t of templates) m[t.test_type] = (m[t.test_type] ?? 0) + 1
    return m
  }, [templates])

  const typeOptions: ChipOption<TypeFilter>[] = useMemo(() => {
    const base: ChipOption<TypeFilter>[] = [{ value: 'all', label: 'Todos', count: typeCounts.all }]
    for (const tt of ['DPS', 'PPS', 'CUSTOM'] as TestType[]) {
      if (typeCounts[tt]) base.push({ value: tt, label: tt, count: typeCounts[tt] })
    }
    return base
  }, [typeCounts])

  const stdOptions: ChipOption<StdFilter>[] = [
    { value: 'all', label: 'Todos' },
    { value: 'std', label: 'Estándar' },
    { value: 'custom', label: 'Personalizados' },
  ]

  const filtered = useMemo(() => {
    const q = query.trim()
    const nq = q ? norm(q) : ''
    return templates.filter(t => {
      if (typeFilter !== 'all' && t.test_type !== typeFilter) return false
      if (stdFilter === 'std' && !t.is_standard) return false
      if (stdFilter === 'custom' && t.is_standard) return false
      if (!nq) return true
      return norm(t.name).includes(nq)
        || norm(t.code).includes(nq)
        || (t.description ? norm(t.description).includes(nq) : false)
    })
  }, [templates, query, typeFilter, stdFilter])

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Tests</h1>
          <p className="text-[var(--muted-foreground)]">
            {filtered.length} {filtered.length === templates.length ? '' : `de ${templates.length}`} configuraciones
          </p>
        </div>
        <Link to="/tests/nuevo">
          <Button><Plus className="w-4 h-4" /> Nuevo test</Button>
        </Link>
      </div>

      <div className="mb-4 space-y-3">
        <SearchBar
          value={query}
          onChange={setQuery}
          placeholder="Buscar por nombre, código o descripción..."
        />
        <div className="flex gap-4 flex-wrap">
          <FilterChips label="Tipo:" options={typeOptions} value={typeFilter} onChange={setTypeFilter} />
          <FilterChips label="Origen:" options={stdOptions} value={stdFilter} onChange={setStdFilter} />
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-[var(--muted-foreground)]">
            {templates.length === 0 ? 'Sin tests aún.' : 'Sin coincidencias. Probá limpiar filtros.'}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map(t => (
            <Link key={t.id} to={`/tests/${t.id}`}>
              <Card className="hover:border-[var(--primary)] transition-colors">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] flex items-center justify-center">
                    <Settings2 className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="font-semibold">{t.name}</div>
                      <Badge variant="outline">{t.test_type}</Badge>
                      {t.is_standard ? <Badge variant="secondary">Estándar</Badge> : null}
                      <span className="text-[11px] text-[var(--muted-foreground)] font-mono">{t.code}</span>
                    </div>
                    <div className="text-sm text-[var(--muted-foreground)]">{t.description}</div>
                    <div className="text-xs text-[var(--muted-foreground)] mt-1">
                      Práctica: {t.config.practice_sequences.length} • Test: {t.config.test_sequences.length} ítems
                    </div>
                  </div>
                  {!t.is_standard && (
                    <button
                      onClick={(e) => handleDelete(t.id, e)}
                      className="p-2 rounded-md hover:bg-[var(--destructive)]/10 text-[var(--destructive)]"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
