import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, Settings2, ArrowUpDown, ChevronRight, ChevronDown, FolderOpen, Package as PackageIcon, User as UserIcon, PlusCircle, X } from 'lucide-react'
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

type EngineKey = 'patterns' | 'srt' | 'dichotic' | 'hint' | 'matrix' | 'ssw'

const ENGINES_WITH_EDITOR: ReadonlySet<EngineKey> = new Set(['patterns', 'srt', 'dichotic', 'hint', 'matrix', 'ssw'])

function detectEngine(cfg: TestTemplateParsed['config']): EngineKey {
  if (cfg.srt) return 'srt'
  if (cfg.dichotic_digits) return 'dichotic'
  if (cfg.hint) return 'hint'
  if (cfg.matrix) return 'matrix'
  if (cfg.ssw) return 'ssw'
  return 'patterns'
}

const ENGINES: Array<{ key: EngineKey; label: string; desc: string; enabled: boolean }> = [
  { key: 'patterns', label: 'Patrones tonales (DPS/PPS/CUSTOM)', desc: 'Secuencias de tonos cortos/largos, memoria temporal, patrones.', enabled: true },
  { key: 'srt', label: 'Logoaudiometría SRT', desc: 'Umbral de recepción de habla con bracketing adaptativo.', enabled: true },
  { key: 'dichotic', label: 'Dichotic Digits', desc: 'Dígitos simultáneos por oído, recuerdo libre/dirigido.', enabled: true },
  { key: 'hint', label: 'HINT / SinB', desc: 'Frases en ruido con SNR adaptativo.', enabled: true },
  { key: 'matrix', label: 'Matrix 5-AFC', desc: 'Oraciones matriciales con grid 5×10 y SNR adaptativo.', enabled: true },
  { key: 'ssw', label: 'SSW (Staggered Spondaic Word)', desc: 'Palabras espondaicas dicóticas escalonadas, 4 condiciones (RNC/RC/LC/LNC).', enabled: true },
]

export function TestsPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [engineDialog, setEngineDialog] = useState<{ family?: string } | null>(null)
  const [templates, setTemplates] = useState<TestTemplateParsed[]>([])
  const [treeInfo, setTreeInfo] = useState<Map<number, TemplateTreeInfo>>(new Map())
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [stdFilter, setStdFilter] = useState<StdFilter>('all')
  const [view, setView] = useState<ViewMode>('by_family')
  const [sort, setSort] = useState<SortKey>('name_asc')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [expandedSubs, setExpandedSubs] = useState<Set<string>>(new Set())
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

  type FlatGroup = { kind: 'flat'; key: string; label: string; items: TestTemplateParsed[] }
  type FamilySubgroup = {
    key: string
    family: string | null
    label: string
    std: TestTemplateParsed[]
    custom: TestTemplateParsed[]
    engine: EngineKey | null
  }
  type PackGroup = {
    kind: 'pack'
    key: string
    label: string
    families: FamilySubgroup[]
    total: number
  }
  type Group = FlatGroup | PackGroup

  const familyOf = (t: TestTemplateParsed): string | null => {
    const info = treeInfo.get(t.id)
    if (info?.family) return info.family
    if (info?.pack_category) return info.pack_category
    return t.config.family ?? null
  }

  // family → { packId, packName } derivado de los std (los packs traen la familia en tests_meta).
  const familyToPack = useMemo(() => {
    const m = new Map<string, { packId: number; packName: string }>()
    for (const t of templates) {
      const info = treeInfo.get(t.id)
      if (info?.pack_id && info.pack_name) {
        const fam = info.family ?? info.pack_category
        if (fam && !m.has(fam)) m.set(fam, { packId: info.pack_id, packName: info.pack_name })
      }
    }
    return m
  }, [templates, treeInfo])

  // familia → motor (derivado del primer std template con ese family/pack_category)
  const familyEngine = useMemo(() => {
    const m = new Map<string, EngineKey>()
    for (const t of templates) {
      if (!t.is_standard) continue
      const info = treeInfo.get(t.id)
      const fam = info?.family ?? info?.pack_category ?? t.config.family ?? null
      if (!fam) continue
      if (!m.has(fam)) m.set(fam, detectEngine(t.config))
    }
    return m
  }, [templates, treeInfo])

  const groups = useMemo<Group[]>(() => {
    if (view === 'flat') {
      return [{ kind: 'flat', key: 'all', label: `Todos (${filtered.length})`, items: filtered }]
    }
    if (view === 'by_pack') {
      const map = new Map<string, { label: string; items: TestTemplateParsed[] }>()
      for (const t of filtered) {
        const info = treeInfo.get(t.id)
        const key = info?.pack_id ? `pack_${info.pack_id}` : '__custom__'
        const label = info?.pack_id ? (info.pack_name ?? 'Sin pack') : 'Personalizados'
        const g = map.get(key) ?? { label, items: [] }
        g.items.push(t)
        map.set(key, g)
      }
      return [...map.entries()]
        .map<FlatGroup>(([key, g]) => ({ kind: 'flat', key, label: `${g.label} (${g.items.length})`, items: g.items }))
        .sort((a, b) => {
          if (a.key === '__custom__') return 1
          if (b.key === '__custom__') return -1
          return a.label.localeCompare(b.label)
        })
    }
    // by_family — Pack > Familia > tests + subcarpeta Personalizados con "+ Crear nuevo".
    const packs = new Map<string, PackGroup>()
    const ensurePack = (key: string, label: string): PackGroup => {
      let g = packs.get(key)
      if (!g) { g = { kind: 'pack', key, label, families: [], total: 0 }; packs.set(key, g) }
      return g
    }
    const ensureFamily = (pack: PackGroup, fam: string | null): FamilySubgroup => {
      const fkey = fam ?? '__none__'
      let f = pack.families.find(x => x.key === fkey)
      if (!f) {
        f = { key: fkey, family: fam, label: fam ?? 'Sin familia', std: [], custom: [], engine: null }
        pack.families.push(f)
      }
      return f
    }
    const familyLabels = new Map<string, string>()
    for (const t of templates) {
      const info = treeInfo.get(t.id)
      if (info?.family && info.family_label) familyLabels.set(info.family, info.family_label)
    }
    for (const t of filtered) {
      const info = treeInfo.get(t.id)
      const fam = familyOf(t)
      let packKey: string
      let packLabel: string
      if (info?.pack_id) {
        packKey = `pack_${info.pack_id}`
        packLabel = info.pack_name ?? 'Sin pack'
      } else if (fam && familyToPack.has(fam)) {
        const ref = familyToPack.get(fam)!
        packKey = `pack_${ref.packId}`
        packLabel = ref.packName
      } else {
        packKey = '__custom__'
        packLabel = 'Personalizados'
      }
      const pack = ensurePack(packKey, packLabel)
      const family = ensureFamily(pack, fam)
      if (fam && familyLabels.has(fam)) family.label = familyLabels.get(fam)!
      if (t.is_standard) family.std.push(t)
      else family.custom.push(t)
      if (family.engine == null) family.engine = detectEngine(t.config)
      pack.total++
    }
    for (const p of packs.values()) {
      p.families.sort((a, b) => {
        if (a.key === '__none__') return 1
        if (b.key === '__none__') return -1
        return a.label.localeCompare(b.label)
      })
    }
    return [...packs.values()].sort((a, b) => {
      if (a.key === '__custom__') return 1
      if (b.key === '__custom__') return -1
      return a.label.localeCompare(b.label)
    })
  }, [filtered, view, treeInfo, familyToPack])

  const toggleGroup = (k: string) => {
    setCollapsed(prev => {
      const n = new Set(prev)
      if (n.has(k)) n.delete(k)
      else n.add(k)
      return n
    })
  }

  const toggleSub = (k: string) => {
    setExpandedSubs(prev => {
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
    if (k === '__custom__' || k === '__nofamily__') return <UserIcon className="w-3.5 h-3.5" />
    if (view === 'by_pack') return <PackageIcon className="w-3.5 h-3.5" />
    return <FolderOpen className="w-3.5 h-3.5" />
  }

  const TemplateRow = ({ t }: { t: TestTemplateParsed }) => (
    <li>
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
  )

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-3xl font-bold">Tests</h1>
          <p className="text-[var(--muted-foreground)]">
            {filtered.length} {filtered.length === templates.length ? '' : `de ${templates.length}`} configuraciones
          </p>
        </div>
        <Button onClick={() => setEngineDialog({})}><Plus className="w-4 h-4" /> Nuevo test</Button>
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
              if (g.kind === 'flat') {
                return (
                  <div key={g.key} className="mb-1">
                    {view !== 'flat' && (
                      <button
                        onClick={() => toggleGroup(g.key)}
                        className="w-full flex items-center gap-1.5 px-2 py-1.5 text-xs font-semibold text-[var(--foreground)]/80 hover:bg-[var(--secondary)] rounded"
                      >
                        {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        <GroupIcon k={g.key} />
                        <span className="truncate">{g.label}</span>
                      </button>
                    )}
                    {!isCollapsed && (
                      <ul className={view !== 'flat' ? 'pl-4 mt-0.5 space-y-0.5' : 'space-y-0.5'}>
                        {g.items.map(t => <TemplateRow key={t.id} t={t} />)}
                      </ul>
                    )}
                  </div>
                )
              }
              // pack group con familias anidadas
              return (
                <div key={g.key} className="mb-1">
                  <button
                    onClick={() => toggleGroup(g.key)}
                    className="w-full flex items-center gap-1.5 px-2 py-1.5 text-xs font-semibold text-[var(--foreground)]/80 hover:bg-[var(--secondary)] rounded"
                  >
                    {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    <PackageIcon className="w-3.5 h-3.5" />
                    <span className="truncate">{g.label} ({g.total})</span>
                  </button>
                  {!isCollapsed && (
                    <div className="pl-4 mt-0.5 space-y-1">
                      {g.families.map(f => {
                        const famKey = `${g.key}__fam_${f.key}`
                        const famCollapsed = !expandedSubs.has(famKey)
                        const customKey = `${famKey}__custom`
                        const customCollapsed = !expandedSubs.has(customKey)
                        const famTotal = f.std.length + f.custom.length
                        return (
                          <div key={f.key}>
                            <button
                              onClick={() => toggleSub(famKey)}
                              className="w-full flex items-center gap-1.5 px-2 py-1 text-[11px] font-medium text-[var(--foreground)]/70 hover:bg-[var(--secondary)] rounded"
                            >
                              {famCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                              <FolderOpen className="w-3 h-3" />
                              <span className="truncate">{f.label} ({famTotal})</span>
                            </button>
                            {!famCollapsed && (
                              <div className="pl-4 mt-0.5">
                                <ul className="space-y-0.5">
                                  {f.std.map(t => <TemplateRow key={t.id} t={t} />)}
                                </ul>
                                <button
                                  onClick={() => toggleSub(customKey)}
                                  className="w-full flex items-center gap-1.5 px-2 py-1 mt-1 text-[10px] font-medium text-[var(--muted-foreground)] hover:bg-[var(--secondary)] rounded"
                                >
                                  {customCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                  <UserIcon className="w-3 h-3" />
                                  <span className="truncate">Personalizados ({f.custom.length})</span>
                                </button>
                                {!customCollapsed && (
                                  <ul className="pl-4 mt-0.5 space-y-0.5">
                                    {f.custom.map(t => <TemplateRow key={t.id} t={t} />)}
                                    {(() => {
                                      const famEng = f.engine ?? (f.family ? familyEngine.get(f.family) ?? null : null)
                                      if (famEng && !ENGINES_WITH_EDITOR.has(famEng)) return null
                                      return (
                                        <li>
                                          <button
                                            onClick={() => {
                                              if (famEng) {
                                                const qs = new URLSearchParams()
                                                qs.set('engine', famEng)
                                                if (f.family) qs.set('family', f.family)
                                                navigate(`/tests/nuevo?${qs.toString()}`)
                                              } else {
                                                setEngineDialog({ family: f.family ?? undefined })
                                              }
                                            }}
                                            className="w-full text-left px-2 py-1.5 rounded text-sm flex items-center gap-2 text-[var(--primary)] hover:bg-[var(--primary)]/10"
                                          >
                                            <PlusCircle className="w-3.5 h-3.5 shrink-0" />
                                            <span className="flex-1 min-w-0 truncate">Crear nuevo</span>
                                          </button>
                                        </li>
                                      )
                                    })()}
                                  </ul>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
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

      {engineDialog && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setEngineDialog(null)}
        >
          <div
            className="bg-[var(--card)] border border-[var(--border)] rounded-lg max-w-lg w-full p-5 shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-bold">Elegí motor del test</h2>
              <button
                onClick={() => setEngineDialog(null)}
                className="p-1 rounded hover:bg-[var(--secondary)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2">
              {ENGINES.map(e => (
                <button
                  key={e.key}
                  disabled={!e.enabled}
                  onClick={() => {
                    if (!e.enabled) return
                    const qs = new URLSearchParams()
                    qs.set('engine', e.key)
                    if (engineDialog.family) qs.set('family', engineDialog.family)
                    navigate(`/tests/nuevo?${qs.toString()}`)
                    setEngineDialog(null)
                  }}
                  className={cn(
                    'w-full text-left p-3 rounded-lg border transition-colors',
                    e.enabled
                      ? 'border-[var(--border)] hover:border-[var(--primary)] hover:bg-[var(--primary)]/5 cursor-pointer'
                      : 'border-[var(--border)] opacity-50 cursor-not-allowed',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm">{e.label}</span>
                    {!e.enabled && (
                      <Badge variant="outline" className="text-[10px]">Próximamente</Badge>
                    )}
                  </div>
                  <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{e.desc}</p>
                </button>
              ))}
            </div>
          </div>
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
