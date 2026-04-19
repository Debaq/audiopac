import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ChevronRight, Search, Link2, ExternalLink } from 'lucide-react'
import roadmapRaw from '../../docs/ROADMAP_PAC.md?raw'
import { parseRoadmap, globalStats, slugify, STATUS_META, type RoadmapSection } from '@/lib/roadmapParser'
import { cn } from '@/lib/utils'

type FilterKey = 'all' | 'done' | 'pending' | 'in_progress' | 'partial' | 'blocked'

const FILTER_LABELS: Record<FilterKey, string> = {
  all: 'Todo',
  done: '✅ Hecho',
  pending: '📝 Pendiente',
  in_progress: '🚧 En curso',
  partial: '⚠️ Parcial',
  blocked: '❌ Bloqueado',
}

const FILTER_FROM_QS: Record<string, FilterKey> = {
  'hecho': 'done',
  'pendiente': 'pending',
  'en-curso': 'in_progress',
  'parcial': 'partial',
  'bloqueado': 'blocked',
}
const FILTER_TO_QS: Record<FilterKey, string> = {
  all: '',
  done: 'hecho',
  pending: 'pendiente',
  in_progress: 'en-curso',
  partial: 'parcial',
  blocked: 'bloqueado',
}

function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function sectionMatchesSearch(s: RoadmapSection, q: string): boolean {
  if (!q) return true
  const nq = norm(q)
  if (norm(s.title).includes(nq)) return true
  if (norm(s.body).includes(nq)) return true
  return false
}

function sectionMatchesFilter(s: RoadmapSection, f: FilterKey): boolean {
  if (f === 'all') return true
  if (s.status === f) return true
  // si algún descendiente matchea, también se incluye (mostramos el padre como contenedor)
  return s.counts[f === 'in_progress' ? 'inProgress' : f] > 0
}

function buildFilteredMd(
  sections: RoadmapSection[],
  filter: FilterKey,
  search: string,
  preambleLines: string[],
): string {
  const out: string[] = [...preambleLines]
  function walk(s: RoadmapSection) {
    const matches = sectionMatchesFilter(s, filter) && sectionMatchesSearch(s, search)
    if (!matches) return
    // Heading line (preservar nivel original)
    out.push(`${'#'.repeat(s.level)} ${s.rawTitle}`)
    // Body hasta la primera subsección hijo
    const firstChild = s.children[0]
    const localBody = s.body
    if (firstChild) {
      const bodyLines = localBody.split('\n')
      const bodyLen = firstChild.startLine - (s.startLine + 1)
      out.push(bodyLines.slice(0, bodyLen).join('\n'))
    } else {
      out.push(localBody)
    }
    for (const ch of s.children) walk(ch)
  }
  for (const s of sections) walk(s)
  return out.join('\n')
}

export function RoadmapPage() {
  const parsed = useMemo(() => parseRoadmap(roadmapRaw), [])
  const stats = useMemo(() => globalStats(parsed), [parsed])
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const contentRef = useRef<HTMLDivElement>(null)

  const qsFilter = searchParams.get('filter') || ''
  const initialFilter: FilterKey = FILTER_FROM_QS[qsFilter] ?? 'all'
  const [filter, setFilter] = useState<FilterKey>(initialFilter)
  const [search, setSearch] = useState('')
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [activeId, setActiveId] = useState<string | null>(null)

  // Sync filter → URL query
  useEffect(() => {
    const qs = FILTER_TO_QS[filter]
    const next = new URLSearchParams(searchParams)
    if (qs) next.set('filter', qs); else next.delete('filter')
    setSearchParams(next, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter])

  // Preamble: contenido antes del primer h2, sin el h1 principal (ya lo muestra el header)
  const preamble = useMemo(() => {
    const lines = roadmapRaw.split('\n')
    const firstH2 = parsed.sections[0]?.startLine ?? lines.length
    return lines.slice(0, firstH2).filter(l => !/^#\s+/.test(l))
  }, [parsed])

  const filteredMd = useMemo(
    () => buildFilteredMd(parsed.sections, filter, search, preamble),
    [parsed, filter, search, preamble],
  )

  const total = stats.total || 1
  const pct = Math.round((stats.done / total) * 100)

  // IntersectionObserver para heading activo
  useEffect(() => {
    const root = contentRef.current
    if (!root) return
    const headings = root.querySelectorAll<HTMLElement>('h2[id], h3[id], h4[id]')
    if (!headings.length) return
    const seen = new Map<string, number>()
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) seen.set(e.target.id, e.intersectionRatio)
        let best: string | null = null
        let max = 0
        // Preferir el primer heading visible cerca del top
        headings.forEach(h => {
          const rect = h.getBoundingClientRect()
          if (rect.top >= -50 && rect.top < window.innerHeight * 0.6) {
            if (best === null) { best = h.id; max = 1 }
          }
          const r = seen.get(h.id) ?? 0
          if (r > max) { max = r; best = h.id }
        })
        if (best) setActiveId(best)
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: [0, 0.5, 1] },
    )
    headings.forEach(h => obs.observe(h))
    return () => obs.disconnect()
  }, [filteredMd])

  // Scroll al hash al montar o cuando cambia hash
  useEffect(() => {
    if (!location.hash) return
    const id = decodeURIComponent(location.hash.slice(1))
    const el = contentRef.current?.querySelector<HTMLElement>(`#${CSS.escape(id)}`)
    if (el) {
      requestAnimationFrame(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }))
      setActiveId(id)
    }
  }, [location.hash, filteredMd])

  const toggleCollapse = (id: string) => setCollapsed(c => ({ ...c, [id]: !c[id] }))

  const handleTocClick = (id: string) => {
    navigate({ hash: `#${id}`, search: location.search }, { replace: false })
  }

  const copyLink = async (id: string) => {
    const url = `${window.location.origin}${window.location.pathname}?${FILTER_TO_QS[filter] ? `filter=${FILTER_TO_QS[filter]}` : ''}#${id}`
    try { await navigator.clipboard.writeText(url) } catch { /* noop */ }
  }

  // Custom components para react-markdown — agrega id + data-status a headings
  const mdComponents = useMemo(() => {
    function makeHeading(level: 1 | 2 | 3 | 4) {
      return function H({ children }: { children?: React.ReactNode }) {
        const Tag = `h${level}` as 'h1' | 'h2' | 'h3' | 'h4'
        const text = childrenToText(children)
        const cleaned = text.replace(/[✅🚧⚠️⚠❌📝]/g, '').trim()
        const base = slugify(cleaned) || 'section'
        const id = parsed.all.find(s => s.level === level && slugify(s.title) && base.startsWith(slugify(s.title)))?.id
          ?? parsed.all.find(s => s.rawTitle.trim() === text.trim())?.id
          ?? base
        const section = parsed.slugToSection.get(id)
        const status = section?.status ?? 'unknown'
        const emoji = STATUS_META[status].emoji
        return (
          <Tag id={id} data-status={status} className="group scroll-mt-24 relative">
            {status !== 'unknown' && (
              <span className="mr-2 text-sm opacity-70" aria-hidden>{emoji}</span>
            )}
            {children}
            <button
              onClick={() => copyLink(id)}
              className="ml-2 opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity text-xs align-middle"
              title="Copiar enlace a esta sección"
            >
              <Link2 className="w-3.5 h-3.5 inline" />
            </button>
          </Tag>
        )
      }
    }
    return {
      h1: makeHeading(1),
      h2: makeHeading(2),
      h3: makeHeading(3),
      h4: makeHeading(4),
      a: ({ href, children }: { href?: string; children?: React.ReactNode }) => {
        const isExternal = href && /^https?:/.test(href)
        if (href && href.startsWith('#')) {
          const id = decodeURIComponent(href.slice(1))
          return (
            <a
              href={href}
              onClick={(e) => {
                e.preventDefault()
                navigate({ hash: `#${id}`, search: location.search })
              }}
              className="underline text-[var(--primary)]"
            >
              {children}
            </a>
          )
        }
        return (
          <a href={href} target={isExternal ? '_blank' : undefined} rel="noreferrer" className="underline text-[var(--primary)]">
            {children}
            {isExternal && <ExternalLink className="w-3 h-3 inline ml-0.5" />}
          </a>
        )
      },
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsed, filter, location.search])

  return (
    <div className="h-full flex">
      {/* Sidebar */}
      <aside className="w-[320px] shrink-0 border-r border-[var(--border)] overflow-y-auto sticky top-0 max-h-screen bg-[var(--background)]">
        <div className="p-4 space-y-3">
          <div>
            <div className="flex items-baseline justify-between mb-1">
              <h2 className="text-sm font-bold uppercase tracking-widest text-[var(--muted-foreground)]">Roadmap</h2>
              <span className="text-xs text-[var(--muted-foreground)]">{stats.done}/{stats.total}</span>
            </div>
            <div className="h-2 bg-[var(--secondary)] rounded-full overflow-hidden">
              <div className="h-full brand-gradient transition-all" style={{ width: `${pct}%` }} />
            </div>
            <div className="text-[11px] text-[var(--muted-foreground)] mt-1">{pct}% completado · {stats.inProgress} en curso · {stats.pending} pendientes</div>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" />
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar en roadmap…"
              className="w-full pl-8 pr-2 py-1.5 text-sm rounded border border-[var(--border)] bg-[var(--background)]"
            />
          </div>

          <div className="flex flex-wrap gap-1">
            {(Object.keys(FILTER_LABELS) as FilterKey[]).map(k => (
              <button
                key={k}
                onClick={() => setFilter(k)}
                className={cn(
                  'px-2 py-0.5 rounded-full text-[11px] font-medium border transition-colors',
                  filter === k
                    ? 'bg-[var(--primary)] text-[var(--primary-foreground)] border-[var(--primary)]'
                    : 'bg-[var(--secondary)]/40 border-[var(--border)] hover:bg-[var(--secondary)]',
                )}
              >
                {FILTER_LABELS[k]}
              </button>
            ))}
          </div>

          <nav className="text-sm">
            {parsed.sections.map(s => (
              <TocNode
                key={s.id}
                section={s}
                activeId={activeId}
                collapsed={collapsed}
                toggleCollapse={toggleCollapse}
                onClick={handleTocClick}
                search={search}
                filter={filter}
              />
            ))}
          </nav>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto" ref={contentRef}>
        <div className="max-w-4xl mx-auto p-8">
          <div className="mb-6">
            <h1 className="text-3xl font-black tracking-tight brand-gradient-text">Roadmap AudioPAC</h1>
            <p className="text-sm text-[var(--muted-foreground)] mt-1">
              Estado del proyecto — lo hecho y lo que falta. Fuente: <code className="text-xs">docs/ROADMAP_PAC.md</code>
            </p>
          </div>
          <article className="roadmap-md">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents as never}>
              {filteredMd}
            </ReactMarkdown>
          </article>
        </div>
      </main>
    </div>
  )
}

function TocNode({
  section, activeId, collapsed, toggleCollapse, onClick, search, filter,
}: {
  section: RoadmapSection
  activeId: string | null
  collapsed: Record<string, boolean>
  toggleCollapse: (id: string) => void
  onClick: (id: string) => void
  search: string
  filter: FilterKey
}) {
  const matches = sectionMatchesFilter(section, filter) && sectionMatchesSearch(section, search)
  if (!matches) return null

  const isCollapsed = collapsed[section.id] ?? section.level > 2
  const hasChildren = section.children.length > 0
  const isActive = activeId === section.id
  const pendCount =
    section.counts.pending + section.counts.partial + section.counts.inProgress + section.counts.blocked
  const statusMeta = STATUS_META[section.status]
  const indent = (section.level - 2) * 10

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-1 py-1 pr-1 rounded cursor-pointer transition-colors',
          isActive ? 'bg-[var(--primary)]/10 text-[var(--primary)] font-semibold' : 'hover:bg-[var(--secondary)]/60',
        )}
        style={{ paddingLeft: 4 + indent }}
      >
        {hasChildren ? (
          <button
            onClick={(e) => { e.stopPropagation(); toggleCollapse(section.id) }}
            className="p-0.5 rounded hover:bg-[var(--secondary)]"
            aria-label={isCollapsed ? 'Expandir' : 'Colapsar'}
          >
            <ChevronRight className={cn('w-3 h-3 transition-transform', !isCollapsed && 'rotate-90')} />
          </button>
        ) : (
          <span className="w-4" />
        )}
        <span
          className="text-[13px] flex-1 truncate"
          onClick={() => onClick(section.id)}
          title={section.title}
        >
          <span className="mr-1 opacity-80" aria-hidden>{statusMeta.emoji}</span>
          {section.title}
        </span>
        {pendCount > 0 && (
          <span className="text-[10px] text-[var(--muted-foreground)] shrink-0">
            {section.counts.done}/{section.counts.total}
          </span>
        )}
      </div>
      {!isCollapsed && hasChildren && (
        <div>
          {section.children.map(ch => (
            <TocNode
              key={ch.id}
              section={ch}
              activeId={activeId}
              collapsed={collapsed}
              toggleCollapse={toggleCollapse}
              onClick={onClick}
              search={search}
              filter={filter}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function childrenToText(children: React.ReactNode): string {
  if (typeof children === 'string' || typeof children === 'number') return String(children)
  if (Array.isArray(children)) return children.map(childrenToText).join('')
  if (children && typeof children === 'object' && 'props' in children) {
    const props = (children as { props?: { children?: React.ReactNode } }).props
    return childrenToText(props?.children)
  }
  return ''
}
