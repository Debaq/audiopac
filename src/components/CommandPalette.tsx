import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, User, Settings2, FileText, Package, ArrowRight, Map } from 'lucide-react'
import { listPatients } from '@/lib/db/patients'
import { listTemplates } from '@/lib/db/templates'
import { listAllSessions } from '@/lib/db/sessions'
import { listInstalledPacks } from '@/lib/packs/installer'
import type { Patient, TestTemplateParsed, SessionWithDetails } from '@/types'
import type { InstalledPack } from '@/lib/packs/installer'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/utils'
import { STATUS_META } from '@/lib/roadmapParser'
import { roadmapParsed } from '@/lib/roadmapData'

type Item =
  | { kind: 'patient'; id: number; title: string; sub: string }
  | { kind: 'test'; id: number; title: string; sub: string }
  | { kind: 'session'; id: number; title: string; sub: string }
  | { kind: 'pack'; code: string; title: string; sub: string }
  | { kind: 'roadmap'; id: string; title: string; sub: string }

const ROADMAP_INDEX = roadmapParsed.all

function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
}

const ICON: Record<Item['kind'], typeof User> = {
  patient: User, test: Settings2, session: FileText, pack: Package, roadmap: Map,
}
const LABEL: Record<Item['kind'], string> = {
  patient: 'Paciente', test: 'Test', session: 'Informe', pack: 'Paquete', roadmap: 'Roadmap',
}

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [patients, setPatients] = useState<Patient[]>([])
  const [tests, setTests] = useState<TestTemplateParsed[]>([])
  const [sessions, setSessions] = useState<SessionWithDetails[]>([])
  const [packs, setPacks] = useState<InstalledPack[]>([])
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(o => !o)
      } else if (e.key === 'Escape' && open) {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  useEffect(() => {
    if (!open) return
    setQuery('')
    setSelected(0)
    setTimeout(() => inputRef.current?.focus(), 10)
    Promise.all([
      listPatients(),
      listTemplates(true),
      listAllSessions(200),
      listInstalledPacks(),
    ]).then(([p, t, s, pk]) => {
      setPatients(p); setTests(t); setSessions(s); setPacks(pk)
    })
  }, [open])

  const items = useMemo<Item[]>(() => {
    const nq = norm(query.trim())
    const out: Item[] = []
    for (const p of patients) {
      const title = `${p.last_name}, ${p.first_name}`
      const sub = [p.document_id, p.birth_date && formatDate(p.birth_date)].filter(Boolean).join(' · ')
      if (!nq || norm(title).includes(nq) || norm(p.document_id ?? '').includes(nq))
        out.push({ kind: 'patient', id: p.id, title, sub })
    }
    for (const t of tests) {
      const title = t.name
      const sub = `${t.code} · ${t.test_type}`
      if (!nq || norm(title).includes(nq) || norm(t.code).includes(nq) || norm(t.description ?? '').includes(nq))
        out.push({ kind: 'test', id: t.id, title, sub })
    }
    for (const s of sessions) {
      const title = `${s.patient_name} — ${s.template_name}`
      const sub = formatDate(s.started_at)
      if (!nq || norm(title).includes(nq))
        out.push({ kind: 'session', id: s.id, title, sub })
    }
    for (const pk of packs) {
      if (!nq || norm(pk.name).includes(nq) || norm(pk.code).includes(nq))
        out.push({ kind: 'pack', code: pk.code, title: pk.name, sub: `${pk.code} · v${pk.version}` })
    }
    if (nq) {
      for (const rs of ROADMAP_INDEX) {
        if (norm(rs.title).includes(nq)) {
          const meta = STATUS_META[rs.status]
          out.push({ kind: 'roadmap', id: rs.id, title: `${meta.emoji} ${rs.title}`, sub: `§${'#'.repeat(rs.level - 1)} ${meta.label}` })
        }
      }
    }
    return out.slice(0, 50)
  }, [query, patients, tests, sessions, packs])

  useEffect(() => { setSelected(0) }, [query])

  const go = (it: Item) => {
    setOpen(false)
    if (it.kind === 'patient') navigate(`/pacientes/${it.id}`)
    else if (it.kind === 'test') navigate(`/tests/${it.id}`)
    else if (it.kind === 'session') navigate(`/informes/${it.id}`)
    else if (it.kind === 'pack') navigate('/catalogos')
    else if (it.kind === 'roadmap') navigate(`/roadmap#${it.id}`)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelected(s => Math.min(items.length - 1, s + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelected(s => Math.max(0, s - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const it = items[selected]
      if (it) go(it)
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-24 bg-black/40 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-xl bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border)]">
          <Search className="w-4 h-4 text-[var(--muted-foreground)]" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Buscar pacientes, tests, informes, paquetes..."
            className="flex-1 bg-transparent outline-none text-sm"
          />
          <kbd className="text-[10px] px-1.5 py-0.5 rounded border border-[var(--border)] text-[var(--muted-foreground)]">Esc</kbd>
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {items.length === 0 ? (
            <div className="py-10 text-center text-sm text-[var(--muted-foreground)]">
              {query ? 'Sin resultados' : 'Empezá a escribir para buscar'}
            </div>
          ) : (
            <ul>
              {items.map((it, i) => {
                const Icon = ICON[it.kind]
                const active = i === selected
                return (
                  <li key={`${it.kind}-${'id' in it ? it.id : it.code}`}>
                    <button
                      onMouseEnter={() => setSelected(i)}
                      onClick={() => go(it)}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm',
                        active ? 'bg-[var(--primary)]/10' : 'hover:bg-[var(--secondary)]',
                      )}
                    >
                      <Icon className="w-4 h-4 text-[var(--muted-foreground)] shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="truncate">{it.title}</div>
                        <div className="text-xs text-[var(--muted-foreground)] truncate">{it.sub}</div>
                      </div>
                      <span className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">{LABEL[it.kind]}</span>
                      {active && <ArrowRight className="w-3.5 h-3.5 text-[var(--primary)]" />}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
        <div className="px-4 py-2 border-t border-[var(--border)] text-[10px] text-[var(--muted-foreground)] flex gap-3">
          <span><kbd className="px-1 rounded border border-[var(--border)]">↑↓</kbd> navegar</span>
          <span><kbd className="px-1 rounded border border-[var(--border)]">Enter</kbd> abrir</span>
          <span className="ml-auto"><kbd className="px-1 rounded border border-[var(--border)]">Ctrl+K</kbd> alternar</span>
        </div>
      </div>
    </div>
  )
}
