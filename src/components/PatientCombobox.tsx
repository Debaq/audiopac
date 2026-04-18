import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, UserPlus, X, Check } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { PatientForm } from '@/components/layout/PatientForm'
import { listPatients } from '@/lib/db/patients'
import { calculateAge } from '@/lib/utils'
import type { Patient } from '@/types'

function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
}

function matches(p: Patient, q: string): boolean {
  if (!q) return true
  const nq = norm(q)
  const full = norm(`${p.first_name} ${p.last_name}`)
  if (full.includes(nq)) return true
  if (p.document_id && norm(p.document_id).includes(nq)) return true
  if (String(p.id) === q.trim()) return true
  return false
}

export function PatientCombobox({
  value,
  onChange,
  autoFocus,
}: {
  value: number | null
  onChange: (id: number | null) => void
  autoFocus?: boolean
}) {
  const [patients, setPatients] = useState<Patient[]>([])
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const wrapRef = useRef<HTMLDivElement>(null)

  const load = async () => setPatients(await listPatients())
  useEffect(() => { load() }, [])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const selected = useMemo(
    () => (typeof value === 'number' ? patients.find(p => p.id === value) ?? null : null),
    [patients, value]
  )

  const filtered = useMemo(() => {
    const q = query.trim()
    const base = q ? patients.filter(p => matches(p, q)) : patients
    return base.slice(0, 12)
  }, [patients, query])

  useEffect(() => { setHighlight(0) }, [query, open])

  const pick = (p: Patient) => {
    onChange(p.id)
    setQuery('')
    setOpen(false)
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (!open) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight(h => Math.min(h + 1, filtered.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight(h => Math.max(h - 1, 0)) }
    else if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered[highlight]) pick(filtered[highlight])
      else if (query.trim()) setShowForm(true)
    } else if (e.key === 'Escape') { setOpen(false) }
  }

  return (
    <div ref={wrapRef} className="relative">
      {selected ? (
        <div className="flex items-center gap-2 p-2 pl-3 rounded-md border border-[var(--primary)]/50 bg-[var(--primary)]/5">
          <div className="w-8 h-8 rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] flex items-center justify-center text-xs font-semibold">
            {selected.first_name[0]}{selected.last_name[0]}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm truncate">{selected.last_name}, {selected.first_name}</div>
            <div className="text-[11px] text-[var(--muted-foreground)] truncate">
              {selected.document_id && <span>Doc: {selected.document_id}</span>}
              {selected.birth_date && <span> · {calculateAge(selected.birth_date)} años</span>}
              <span className="ml-1 opacity-60">#{selected.id}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => { onChange(null); setQuery(''); setOpen(true) }}
            className="p-1 rounded hover:bg-[var(--secondary)] text-[var(--muted-foreground)]"
            aria-label="Cambiar paciente"
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
              placeholder="Buscar por nombre, documento o ID..."
              value={query}
              onChange={e => { setQuery(e.target.value); setOpen(true) }}
              onFocus={() => setOpen(true)}
              onKeyDown={onKey}
              className="pl-10"
            />
          </div>

          {open && (
            <div className="absolute z-40 left-0 right-0 mt-1 bg-[var(--card)] border border-[var(--border)] rounded-md shadow-lg max-h-80 overflow-auto">
              {filtered.length === 0 ? (
                <div className="p-3 text-sm">
                  <p className="text-[var(--muted-foreground)] mb-2">
                    {query.trim() ? 'Sin coincidencias.' : 'Sin pacientes.'}
                  </p>
                  <Button size="sm" className="w-full" onClick={() => setShowForm(true)}>
                    <UserPlus className="w-4 h-4" />
                    {query.trim() ? `Crear paciente "${query.trim()}"` : 'Crear paciente nuevo'}
                  </Button>
                </div>
              ) : (
                <>
                  {filtered.map((p, i) => (
                    <button
                      type="button"
                      key={p.id}
                      onClick={() => pick(p)}
                      onMouseEnter={() => setHighlight(i)}
                      className={`w-full text-left px-3 py-2 flex items-center gap-3 transition-colors ${
                        i === highlight ? 'bg-[var(--secondary)]' : ''
                      }`}
                    >
                      <div className="w-8 h-8 rounded-full bg-[var(--primary)]/80 text-[var(--primary-foreground)] flex items-center justify-center text-xs font-semibold shrink-0">
                        {p.first_name[0]}{p.last_name[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{p.last_name}, {p.first_name}</div>
                        <div className="text-[11px] text-[var(--muted-foreground)] truncate">
                          {p.document_id ?? 's/doc'}
                          {p.birth_date && <span> · {calculateAge(p.birth_date)} años</span>}
                          <span className="ml-1 opacity-60">#{p.id}</span>
                        </div>
                      </div>
                      {i === highlight && <Check className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setShowForm(true)}
                    className="w-full text-left px-3 py-2 border-t border-[var(--border)] text-sm flex items-center gap-2 text-[var(--primary)] hover:bg-[var(--secondary)]"
                  >
                    <UserPlus className="w-4 h-4" />
                    {query.trim() ? `Crear "${query.trim()}" como nuevo` : 'Crear paciente nuevo'}
                  </button>
                </>
              )}
            </div>
          )}
        </>
      )}

      {showForm && (() => {
        const q = query.trim()
        const parts = q.split(/\s+/)
        const isNumeric = /^[0-9.\-kK]+$/.test(q)
        return (
          <PatientForm
            defaults={q ? {
              document_id: isNumeric ? q : null,
              first_name: !isNumeric ? (parts[0] ?? '') : '',
              last_name: !isNumeric ? parts.slice(1).join(' ') : '',
            } : undefined}
            onClose={() => setShowForm(false)}
            onSaved={async (nid) => {
              setShowForm(false)
              await load()
              if (nid) onChange(nid)
              setQuery('')
              setOpen(false)
            }}
          />
        )
      })()}
    </div>
  )
}
