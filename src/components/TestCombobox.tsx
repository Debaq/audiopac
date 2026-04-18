import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, X, Settings2, Check } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import type { TestTemplateParsed } from '@/types'

function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
}

function matches(t: TestTemplateParsed, q: string): boolean {
  if (!q) return true
  const nq = norm(q)
  return (
    norm(t.name).includes(nq) ||
    norm(t.code).includes(nq) ||
    (t.description ? norm(t.description).includes(nq) : false) ||
    norm(t.test_type).includes(nq)
  )
}

export function TestCombobox({
  templates,
  value,
  onChange,
  autoFocus,
}: {
  templates: TestTemplateParsed[]
  value: number | null
  onChange: (id: number | null) => void
  autoFocus?: boolean
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const selected = useMemo(
    () => (value != null ? templates.find(t => t.id === value) ?? null : null),
    [templates, value]
  )

  const filtered = useMemo(() => {
    const q = query.trim()
    return (q ? templates.filter(t => matches(t, q)) : templates).slice(0, 20)
  }, [templates, query])

  useEffect(() => { setHighlight(0) }, [query, open])

  const pick = (t: TestTemplateParsed) => {
    onChange(t.id)
    setQuery('')
    setOpen(false)
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (!open) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight(h => Math.min(h + 1, filtered.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight(h => Math.max(h - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); if (filtered[highlight]) pick(filtered[highlight]) }
    else if (e.key === 'Escape') { setOpen(false) }
  }

  return (
    <div ref={wrapRef} className="relative">
      {selected ? (
        <div className="flex items-center gap-2 p-2 pl-3 rounded-md border border-[var(--primary)]/50 bg-[var(--primary)]/5">
          <div className="w-8 h-8 rounded-md bg-[var(--primary)] text-[var(--primary-foreground)] flex items-center justify-center">
            <Settings2 className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm truncate flex items-center gap-2">
              {selected.name}
              <Badge variant="outline" className="text-[10px]">{selected.test_type}</Badge>
            </div>
            <div className="text-[11px] text-[var(--muted-foreground)] font-mono truncate">{selected.code}</div>
          </div>
          <button
            type="button"
            onClick={() => { onChange(null); setQuery(''); setOpen(true) }}
            className="p-1 rounded hover:bg-[var(--secondary)] text-[var(--muted-foreground)]"
            aria-label="Cambiar test"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)] pointer-events-none" />
            <Input
              autoFocus={autoFocus}
              placeholder="Buscar por nombre, código o tipo..."
              value={query}
              onChange={e => { setQuery(e.target.value); setOpen(true) }}
              onFocus={() => setOpen(true)}
              onKeyDown={onKey}
              className="pl-10"
            />
          </div>
          {open && (
            <div className="absolute z-40 left-0 right-0 mt-1 bg-[var(--card)] border border-[var(--border)] rounded-md shadow-lg max-h-96 overflow-auto">
              {filtered.length === 0 ? (
                <p className="p-3 text-sm text-[var(--muted-foreground)]">Sin coincidencias.</p>
              ) : (
                filtered.map((t, i) => (
                  <button
                    type="button"
                    key={t.id}
                    onClick={() => pick(t)}
                    onMouseEnter={() => setHighlight(i)}
                    className={`w-full text-left px-3 py-2 flex items-start gap-3 transition-colors ${
                      i === highlight ? 'bg-[var(--secondary)]' : ''
                    }`}
                  >
                    <Settings2 className="w-4 h-4 mt-0.5 text-[var(--muted-foreground)] shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate flex items-center gap-1.5 flex-wrap">
                        {t.name}
                        <Badge variant="outline" className="text-[10px]">{t.test_type}</Badge>
                        {t.is_standard ? <Badge variant="secondary" className="text-[10px]">std</Badge> : null}
                      </div>
                      <div className="text-[11px] text-[var(--muted-foreground)] truncate">
                        <span className="font-mono">{t.code}</span>
                        {t.description && <span> · {t.description}</span>}
                      </div>
                    </div>
                    {i === highlight && <Check className="w-3.5 h-3.5 text-[var(--muted-foreground)] mt-0.5" />}
                  </button>
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
