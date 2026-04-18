import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Plus, Settings2, ArrowUpDown, ChevronRight, ChevronDown, FolderOpen, Package as PackageIcon, User as UserIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { SearchBar } from '@/components/ui/SearchBar'
import { FilterChips, type ChipOption } from '@/components/ui/FilterChips'
import { TestDetailPanel } from '@/components/TestDetailPanel'
import { PackDetailDialog } from '@/components/PackDetailDialog'
import { listTemplates, deleteTemplate } from '@/lib/db/templates'
import { listTemplateTreeInfo, type TemplateTreeInfo } from '@/lib/packs/interpretation'
import { fetchPacksIndex } from '@/lib/packs/installer'
import type { PacksIndexEntry } from '@/lib/packs/types'
import type { TestTemplateParsed, TestType } from '@/types'
import { cn } from '@/lib/utils'

type TypeFilter = 'all' | TestType
type StdFilter = 'all' | 'std' | 'custom'
type ViewMode = 'flat' | 'by_pack' | 'by_family'
type SortKey = 'name_asc' | 'code_asc' | 'created_desc' | 'type_asc'

const SORT_LABELS: Record<SortKey, string> = {
  name_asc: 'Nombre (A–Z)',
  code_asc: 'Código (A–Z)',
  created_desc: 'Más recientes',
  type_asc: 'Tipo',
}

const VIEW_OPTIONS: ChipOption<ViewMode>[] = [
  { value: 'flat', label: 'Plano' },
  { value: 'by_pack', label: 'Por pack' },
  { value: 'by_family', label: 'Por familia' },
]

function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
}

function cmp(sort: SortKey): (a: TestTemplateParsed, b: TestTemplateParsed) => number {
  switch (sort) {
    case 'name_asc': return (a, b) => a.name.localeCompare(b.name)
    case 'code_asc': return (a, b) => a.code.localeCompare(b.code)
    case 'created_desc': return (a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? '')
    case 'type_asc': return (a, b) => a.test_type.localeCompare(b.test_type) || a.name.localeCompare(b.name)
  }
}

export function TestsPage() {
  const [params, setParams] = useSearchParams()
  const [templates, setTemplates] = useState<TestTemplateParsed[]>([])
  const [treeInfo, setTreeInfo] = useState<Map<number, TemplateTreeInfo>>(new Map())
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [stdFilter, setStdFilter] = useState<StdFilter>('all')
  const [view, setView] = useState<ViewMode>('by_family')
  const [sort, setSort] = useState<SortKey>('name_asc')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [packIndex, setPackIndex] = useState<PacksIndexEntry[]>([])
  const [packDialog, setPackDialog] = useState<PacksIndexEntry | null>(null)

  const load = async () => {
    const [tpls, info] = await Promise.all([listTemplates(false), listTemplateTreeInfo()])
    setTemplates(tpls)
    setTreeInfo(info)
  }
  useEffect(() => { load() }, [])

  useEffect(() => {
    fetchPacksIndex().then(idx => setPackIndex(idx.packs)).catch(() => { /* offline ok */ })
  }, [])

  useEffect(() => {
    const urlSel = params.get('id')
    if (urlSel) setSelectedId(Number(urlSel))
  }, [params])

  useEffect(() => {
    if (selectedId === null && templates.length > 0) {
      setSelectedId(templates[0].id)
    }
  }, [templates, selectedId])

  const handleDelete = async () => {
    if (selectedId === null) return
    if (!confirm('¿Eliminar este test? Solo se pueden eliminar tests personalizados.')) return
    await deleteTemplate(selectedId)
    setSelectedId(null)
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
    const rows = templates.filter(t => {
      if (typeFilter !== 'all' && t.test_type !== typeFilter) return false
      if (stdFilter === 'std' && !t.is_standard) return false
      if (stdFilter === 'custom' && t.is_standard) return false
      if (!nq) return true
      return norm(t.name).includes(nq)
        || norm(t.code).includes(nq)
        || (t.description ? norm(t.description).includes(nq) : false)
    })
    return [...rows].sort(cmp(sort))
  }, [templates, query, typeFilter, stdFilter, sort])

  const groups = useMemo(() => {
    if (view === 'flat') return [{ key: 'all', label: `Todos (${filtered.length})`, items: filtered }]
    const map = new Map<string, { label: string; items: TestTemplateParsed[] }>()
    const keyFor = (t: TestTemplateParsed) => {
      const info = treeInfo.get(t.id)
      if (!info || !info.pack_id) return { key: '__custom__', label: 'Personalizados' }
      if (view === 'by_pack') {
        return { key: `pack_${info.pack_id}`, label: info.pack_name ?? 'Sin pack' }
      }
      // by_family
      const fam = info.family ?? info.pack_category ?? 'Sin familia'
      return { key: `fam_${fam}`, label: fam }
    }
    for (const t of filtered) {
      const { key, label } = keyFor(t)
      const g = map.get(key) ?? { label, items: [] }
      g.items.push(t)
      map.set(key, g)
    }
    return [...map.entries()]
      .map(([key, g]) => ({ key, label: `${g.label} (${g.items.length})`, items: g.items }))
      .sort((a, b) => {
        if (a.key === '__custom__') return 1
        if (b.key === '__custom__') return -1
        return a.label.localeCompare(b.label)
      })
  }, [filtered, view, treeInfo])

  const toggleGroup = (k: string) => {
    setCollapsed(prev => {
      const n = new Set(prev)
      if (n.has(k)) n.delete(k)
      else n.add(k)
      return n
    })
  }

  const selectedTemplate = useMemo(
    () => templates.find(t => t.id === selectedId) ?? null,
    [templates, selectedId],
  )

  const selectTemplate = (id: number) => {
    setSelectedId(id)
    setParams(prev => {
      const p = new URLSearchParams(prev)
      p.set('id', String(id))
      return p
    }, { replace: true })
  }

  const handleOpenPack = (code: string) => {
    const entry = packIndex.find(e => e.id === code)
    if (entry) setPackDialog(entry)
  }

  const GroupIcon = ({ k }: { k: string }) => {
    if (k === '__custom__') return <UserIcon className="w-3.5 h-3.5" />
    if (view === 'by_pack') return <PackageIcon className="w-3.5 h-3.5" />
    return <FolderOpen className="w-3.5 h-3.5" />
  }

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between mb-5">
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
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <div className="flex gap-3 flex-wrap">
            <FilterChips label="Vista:" options={VIEW_OPTIONS} value={view} onChange={setView} />
            <FilterChips label="Tipo:" options={typeOptions} value={typeFilter} onChange={setTypeFilter} />
            <FilterChips label="Origen:" options={stdOptions} value={stdFilter} onChange={setStdFilter} />
          </div>
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
        <Card>
          <CardContent className="py-12 text-center text-sm text-[var(--muted-foreground)]">
            {templates.length === 0 ? 'Sin tests aún.' : 'Sin coincidencias. Probá limpiar filtros.'}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-[340px_1fr] gap-4 min-h-[60vh]">
          <aside className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-2 overflow-y-auto max-h-[78vh]">
            {groups.map(g => {
              const isCollapsed = collapsed.has(g.key)
              return (
                <div key={g.key} className="mb-1">
                  {view !== 'flat' && (
                    <button
                      onClick={() => toggleGroup(g.key)}
                      className="w-full flex items-center gap-1.5 px-2 py-1.5 text-xs font-semibold text-[var(--foreground)]/80 hover:bg-[var(--secondary)] rounded"
                    >
                      {isCollapsed
                        ? <ChevronRight className="w-3.5 h-3.5" />
                        : <ChevronDown className="w-3.5 h-3.5" />}
                      <GroupIcon k={g.key} />
                      <span className="truncate">{g.label}</span>
                    </button>
                  )}
                  {!isCollapsed && (
                    <ul className={view !== 'flat' ? 'pl-4 mt-0.5 space-y-0.5' : 'space-y-0.5'}>
                      {g.items.map(t => (
                        <li key={t.id}>
                          <button
                            onClick={() => selectTemplate(t.id)}
                            className={cn(
                              'w-full text-left px-2 py-1.5 rounded text-sm flex items-center gap-2',
                              selectedId === t.id
                                ? 'bg-[var(--primary)]/15 text-[var(--primary)]'
                                : 'hover:bg-[var(--secondary)]',
                            )}
                          >
                            <Settings2 className="w-3.5 h-3.5 shrink-0 opacity-70" />
                            <span className="flex-1 min-w-0 truncate">{t.name}</span>
                            <span className="text-[9px] font-mono text-[var(--muted-foreground)] shrink-0">{t.test_type}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )
            })}
          </aside>

          <section className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-6 overflow-y-auto max-h-[78vh]">
            {selectedTemplate ? (
              <TestDetailPanel
                template={selectedTemplate}
                onDelete={handleDelete}
                onOpenPack={handleOpenPack}
              />
            ) : (
              <div className="text-center text-sm text-[var(--muted-foreground)] py-16">
                Seleccioná un test para ver su ficha
              </div>
            )}
          </section>
        </div>
      )}

      {packDialog && (
        <PackDetailDialog
          entry={packDialog}
          installedVersion={packDialog.version}
          onClose={() => setPackDialog(null)}
          onChange={() => { load() }}
        />
      )}
    </div>
  )
}
