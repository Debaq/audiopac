import { useEffect, useState } from 'react'
import { Plus, Mic, CheckCircle2, AlertTriangle, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  listStimulusLists, listStimuli, getStimulusListByCode,
  parseStimMetadata, updateStimulusMetadata,
} from '@/lib/db/stimuli'
import { InlineListCreator } from './InlineListCreator'
import type { SSWParams, SSWEarFirstOrder, Stimulus, StimulusList } from '@/types'

export const BLANK_SSW: SSWParams = {
  stimulus_list_code: '',
  level_db: 50,
  num_items: 40,
  ear_first_order: 'RLRL',
  show_pair_label: false,
  iri_ms: 2000,
  catch_trials: null,
}

type Slot = 'RNC' | 'RC' | 'LC' | 'LNC'

interface Props {
  value: SSWParams
  onChange: (v: SSWParams) => void
  disabled?: boolean
  onGoToRecord?: (listCode: string) => void
}

function slotOf(s: Stimulus): { item: number; slot: Slot } | null {
  const meta = parseStimMetadata(s) as { ssw_item?: number; side?: string; position?: number }
  if (!meta.ssw_item || !meta.side || !meta.position) return null
  if ((meta.side !== 'R' && meta.side !== 'L') || (meta.position !== 1 && meta.position !== 2)) return null
  const slot: Slot = meta.side === 'R' ? (meta.position === 1 ? 'RNC' : 'RC') : (meta.position === 1 ? 'LC' : 'LNC')
  return { item: meta.ssw_item, slot }
}

export function SSWConfigEditor({ value, onChange, disabled, onGoToRecord }: Props) {
  const [lists, setLists] = useState<StimulusList[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [selectedList, setSelectedList] = useState<StimulusList | null>(null)
  const [items, setItems] = useState<Stimulus[]>([])
  const [busy, setBusy] = useState(false)

  const refreshLists = () =>
    listStimulusLists().then(all => setLists(all.filter(l => l.category === 'ssw')))

  const refreshItems = async () => {
    if (!value.stimulus_list_code) { setSelectedList(null); setItems([]); return }
    const list = await getStimulusListByCode(value.stimulus_list_code)
    setSelectedList(list)
    if (!list) { setItems([]); return }
    setItems(await listStimuli(list.id))
  }

  useEffect(() => { refreshLists() }, [])
  useEffect(() => { refreshItems() }, [value.stimulus_list_code])

  const editable = !!selectedList && selectedList.is_standard !== 1

  const set = <K extends keyof SSWParams>(k: K, v: SSWParams[K]) => onChange({ ...value, [k]: v })
  const num = (k: keyof SSWParams) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const n = e.target.value === '' ? 0 : Number(e.target.value)
    set(k, n as never)
  }

  const numItems = value.num_items ?? 40

  const assign = async (stim: Stimulus, spec: { item: number; slot: Slot } | null) => {
    if (!editable) return
    setBusy(true)
    try {
      const meta = parseStimMetadata(stim)
      if (!spec) {
        delete meta.ssw_item; delete meta.side; delete meta.position
      } else {
        meta.ssw_item = spec.item
        meta.side = spec.slot === 'RNC' || spec.slot === 'RC' ? 'R' : 'L'
        meta.position = spec.slot === 'RNC' || spec.slot === 'LC' ? 1 : 2
      }
      await updateStimulusMetadata(stim.id, meta)
      await refreshItems()
    } finally { setBusy(false) }
  }

  const autoAssign = async () => {
    if (!editable) return
    const expected = numItems * 4
    if (items.length < expected) {
      if (!confirm(`Se esperan ${expected} tokens (${numItems} ítems × 4). La lista tiene ${items.length}. Asignar los disponibles igual?`)) return
    } else {
      if (!confirm(`Asignar metadata a los primeros ${expected} tokens en orden (item 1 = pos 1–4: RNC, RC, LC, LNC; item 2 = pos 5–8; …)?`)) return
    }
    setBusy(true)
    try {
      const limit = Math.min(items.length, expected)
      const slots: Slot[] = ['RNC', 'RC', 'LC', 'LNC']
      for (let i = 0; i < limit; i++) {
        const stim = items[i]
        const item = Math.floor(i / 4) + 1
        const slot = slots[i % 4]
        const meta = parseStimMetadata(stim)
        meta.ssw_item = item
        meta.side = slot === 'RNC' || slot === 'RC' ? 'R' : 'L'
        meta.position = slot === 'RNC' || slot === 'LC' ? 1 : 2
        await updateStimulusMetadata(stim.id, meta)
      }
      await refreshItems()
    } finally { setBusy(false) }
  }

  // Grid item × slot
  const grid: Record<number, Partial<Record<Slot, Stimulus>>> = {}
  const unassigned: Stimulus[] = []
  for (const s of items) {
    const info = slotOf(s)
    if (!info) { unassigned.push(s); continue }
    if (!grid[info.item]) grid[info.item] = {}
    grid[info.item][info.slot] = s
  }

  const recordedCount = items.filter(s => s.file_path).length
  const totalSlots = numItems * 4
  const completeItems = Array.from({ length: numItems }, (_, i) => i + 1).filter(it => {
    const row = grid[it]
    return row?.RNC?.file_path && row?.RC?.file_path && row?.LC?.file_path && row?.LNC?.file_path
  }).length
  const allReady = completeItems >= numItems

  const DUR_MIN_MS = 450
  const DUR_MAX_MS = 650
  const isOutOfRange = (s: Stimulus | undefined) =>
    !!(s?.file_path && typeof s.duration_ms === 'number' && (s.duration_ms < DUR_MIN_MS || s.duration_ms > DUR_MAX_MS))
  const outOfRangeCount = items.filter(s => isOutOfRange(s)).length

  return (
    <Card className="mb-4">
      <CardHeader><CardTitle>Parámetros SSW</CardTitle></CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,400px)_1fr] gap-5">
          {/* Izquierda */}
          <div className="space-y-4">
            <div>
              <Label>Lista SSW *</Label>
              <div className="flex gap-2">
                <Select
                  value={value.stimulus_list_code}
                  onChange={e => set('stimulus_list_code', e.target.value)}
                  disabled={disabled}
                  className="flex-1"
                >
                  <option value="">— Elegí una lista SSW —</option>
                  {lists.map(l => (
                    <option key={l.id} value={l.code}>{l.name} ({l.code})</option>
                  ))}
                </Select>
                <Button type="button" variant="outline" size="sm" onClick={() => setShowCreate(true)} disabled={disabled}>
                  <Plus className="w-4 h-4" /> Nueva
                </Button>
              </div>
              {selectedList && (
                <div className="mt-2 flex items-center gap-2 text-xs">
                  {allReady ? (
                    <><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span>{completeItems}/{numItems} ítems completos ({recordedCount}/{totalSlots} grabaciones).</span></>
                  ) : (
                    <><AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                    <span>{completeItems}/{numItems} ítems completos · faltan {totalSlots - recordedCount} grabaciones.</span></>
                  )}
                  {onGoToRecord && (
                    <button
                      type="button"
                      onClick={() => onGoToRecord(value.stimulus_list_code)}
                      className="inline-flex items-center gap-1 text-[var(--primary)] hover:underline"
                    >
                      <Mic className="w-3 h-3" /> Guardar y grabar
                    </button>
                  )}
                </div>
              )}
              {lists.length === 0 && (
                <p className="text-[10px] text-[var(--muted-foreground)] mt-1">
                  No hay listas SSW. Creá una nueva o instalá <code>ssw-es-v1</code> desde <code>/catalogos</code>.
                </p>
              )}
            </div>

            <div>
              <Label className="text-xs font-semibold">Presentación</Label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Nivel (dB HL)</Label>
                  <Input type="number" value={value.level_db} onChange={num('level_db')} disabled={disabled} />
                  <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5">Típico SRT+50. Katz recomienda 50 dB HL para adultos normo-oyentes.</p>
                </div>
                <div>
                  <Label>Ítems a presentar</Label>
                  <Input type="number" min={1} max={40} value={numItems} onChange={num('num_items')} disabled={disabled} />
                </div>
                <div>
                  <Label>ISI entre ítems (ms)</Label>
                  <Input type="number" min={0} value={value.iri_ms ?? 2000} onChange={num('iri_ms')} disabled={disabled} />
                </div>
                <div>
                  <Label>Orden ear-first</Label>
                  <Select
                    value={value.ear_first_order ?? 'RLRL'}
                    onChange={e => set('ear_first_order', e.target.value as SSWEarFirstOrder)}
                    disabled={disabled}
                  >
                    <option value="RLRL">RLRL (alternado)</option>
                    <option value="LRLR">LRLR (alternado)</option>
                    <option value="RRLL">RRLL (bloques)</option>
                    <option value="random">Aleatorio</option>
                    <option value="fixed_R">Siempre R-first</option>
                    <option value="fixed_L">Siempre L-first</option>
                  </Select>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="show_pair_label"
                type="checkbox"
                checked={!!value.show_pair_label}
                onChange={e => set('show_pair_label', e.target.checked)}
                disabled={disabled}
              />
              <Label htmlFor="show_pair_label" className="text-xs">Mostrar pair_label al paciente (sólo ensayo)</Label>
            </div>

            <div className="border border-[var(--border)] rounded-md p-2.5 space-y-2">
              <div className="flex items-center gap-2">
                <input
                  id="catch_enabled"
                  type="checkbox"
                  checked={!!value.catch_trials?.enabled}
                  onChange={e => set('catch_trials', e.target.checked
                    ? { enabled: true, every_n: value.catch_trials?.every_n ?? 10 }
                    : null)}
                  disabled={disabled}
                />
                <Label htmlFor="catch_enabled" className="text-xs font-semibold">Catch trials de atención</Label>
              </div>
              {value.catch_trials?.enabled && (
                <div className="flex items-center gap-2 pl-5">
                  <Label className="text-[11px]">Cada</Label>
                  <Input
                    type="number" min={2} max={40}
                    value={value.catch_trials.every_n}
                    onChange={e => set('catch_trials', {
                      enabled: true,
                      every_n: Math.max(2, Number(e.target.value) || 10),
                    })}
                    disabled={disabled}
                    className="w-16 h-7 text-[11px]"
                  />
                  <Label className="text-[11px]">ítems se pregunta "¿qué oído fue primero?"</Label>
                </div>
              )}
              <p className="text-[10px] text-[var(--muted-foreground)]">
                Intercala una pregunta de atención sin audio extra: "¿qué oído escuchaste primero en el ítem anterior?". Valida lateralización y detecta pacientes distraídos. Precisión {'<'}80% marca el informe con <code>atencion_dudosa</code>.
              </p>
            </div>

            <div className="rounded-md bg-[var(--secondary)] p-2.5 text-[11px] text-[var(--muted-foreground)] space-y-1">
              <div><b>SSW</b> (Katz 1962/1998): 40 ítems × 4 hemispondees = 160 respuestas. Cada ítem presenta <code>RNC → (RC ∥ LC) → LNC</code> (R-first) o espejado (L-first).</div>
              <div>Requiere 160 grabaciones ordenadas. Auto-asignar asume secuencia RNC, RC, LC, LNC por ítem.</div>
            </div>
          </div>

          {/* Derecha: grid 40×4 */}
          <div className="space-y-3">
            {selectedList ? (
              <div className="border border-[var(--border)] rounded-md p-3 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Corpus · {completeItems}/{numItems} ítems completos</span>
                    {selectedList.is_standard === 1 ? (
                      <Badge variant="outline" className="text-[10px]"><Lock className="w-3 h-3 inline mr-1" /> estándar</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">editable</Badge>
                    )}
                  </div>
                  <div className="text-xs text-[var(--muted-foreground)]">
                    {items.length} tokens · {recordedCount} grabados · {unassigned.length} sin slot
                  </div>
                </div>

                {outOfRangeCount > 0 && (
                  <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-2 text-[11px]">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold text-amber-700">
                        {outOfRangeCount} hemispondee{outOfRangeCount === 1 ? '' : 's'} con duración fuera de {DUR_MIN_MS}–{DUR_MAX_MS} ms
                      </div>
                      <div className="text-[var(--muted-foreground)]">
                        Durations muy distintas entre RC/LC desalinean el solape dicótico y ensucian el scoring de condiciones competing. Recortá en <code>/estímulos</code> (editor por token) o regrabá.
                      </div>
                    </div>
                  </div>
                )}

                {editable && (
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={autoAssign} disabled={disabled || busy || items.length === 0}>
                      Auto-asignar metadata
                    </Button>
                    <p className="text-[10px] text-[var(--muted-foreground)] self-center">
                      Orden canónico: ítem 1 = [RNC, RC, LC, LNC], ítem 2 = [RNC, RC, LC, LNC], …
                    </p>
                  </div>
                )}

                <div className="max-h-[60vh] overflow-y-auto">
                  <table className="w-full text-[11px]">
                    <thead className="sticky top-0 bg-[var(--card)] z-10 border-b border-[var(--border)]">
                      <tr>
                        <th className="text-left py-1 pr-2">#</th>
                        <th className="text-left px-1">RNC (R-1)</th>
                        <th className="text-left px-1">RC (R-2)</th>
                        <th className="text-left px-1">LC (L-1)</th>
                        <th className="text-left px-1">LNC (L-2)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from({ length: numItems }, (_, i) => i + 1).map(it => {
                        const row = grid[it] ?? {}
                        return (
                          <tr key={it} className="border-b border-[var(--border)]/30">
                            <td className="py-1 pr-2 font-mono text-[var(--muted-foreground)]">{it}</td>
                            {(['RNC', 'RC', 'LC', 'LNC'] as Slot[]).map(slot => {
                              const s = row[slot]
                              return (
                                <td key={slot} className="px-1 py-0.5">
                                  {s ? (
                                    <div
                                      className={`flex items-center gap-1 px-1 py-0.5 rounded border ${isOutOfRange(s) ? 'border-amber-500/50 bg-amber-500/10' : s.file_path ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-amber-500/30 bg-amber-500/5'}`}
                                      title={isOutOfRange(s) ? `Duración ${Math.round(s.duration_ms!)} ms fuera de ${DUR_MIN_MS}–${DUR_MAX_MS} ms` : undefined}
                                    >
                                      <span className="flex-1 truncate">{s.token || '—'}</span>
                                      {isOutOfRange(s) && <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />}
                                      {s.file_path && !isOutOfRange(s) && <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />}
                                      {editable && (
                                        <button
                                          type="button"
                                          onClick={() => assign(s, null)}
                                          className="text-[9px] text-[var(--muted-foreground)] hover:text-red-500"
                                          disabled={busy}
                                          title="Quitar slot"
                                        >×</button>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="px-1 py-0.5 text-[var(--muted-foreground)] italic">vacío</div>
                                  )}
                                </td>
                              )
                            })}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {unassigned.length > 0 && (
                  <div className="border border-amber-500/40 bg-amber-500/5 rounded-md p-2">
                    <div className="text-[11px] font-semibold mb-1 text-amber-700">
                      Sin slot asignado ({unassigned.length})
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {unassigned.map(s => (
                        <UnassignedRow key={s.id} stim={s} numItems={numItems} onAssign={spec => assign(s, spec)} disabled={!editable || busy} />
                      ))}
                    </div>
                  </div>
                )}

                {items.length === 0 && (
                  <p className="text-xs text-[var(--muted-foreground)] py-2">
                    Lista vacía. Agregá 160 tokens en <code>/estímulos</code>.
                  </p>
                )}
              </div>
            ) : (
              <div className="rounded-md border border-dashed border-[var(--border)] p-6 text-center text-xs text-[var(--muted-foreground)]">
                Elegí o creá una lista SSW para asignar slots.
              </div>
            )}
          </div>
        </div>

        {showCreate && (
          <InlineListCreator
            category="ssw"
            categoryLabel="SSW"
            onClose={() => setShowCreate(false)}
            onCreated={async (code) => {
              await refreshLists()
              set('stimulus_list_code', code)
            }}
          />
        )}
      </CardContent>
    </Card>
  )
}

function UnassignedRow({ stim, numItems, onAssign, disabled }: {
  stim: Stimulus
  numItems: number
  onAssign: (spec: { item: number; slot: Slot } | null) => void
  disabled?: boolean
}) {
  const [item, setItem] = useState(1)
  const [slot, setSlot] = useState<Slot>('RNC')
  return (
    <div className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border border-[var(--border)] bg-[var(--secondary)]/40">
      <span className="font-mono text-[9px] text-[var(--muted-foreground)] w-6 text-right">{stim.position}.</span>
      <span className="min-w-[60px] truncate">{stim.token}</span>
      {stim.file_path && <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />}
      <Input type="number" min={1} max={numItems} value={item} onChange={e => setItem(Number(e.target.value))} disabled={disabled} className="w-14 h-6 text-[10px]" />
      <select value={slot} onChange={e => setSlot(e.target.value as Slot)} disabled={disabled} className="bg-[var(--card)] border border-[var(--border)] rounded px-1 py-0.5 text-[10px]">
        <option value="RNC">RNC</option>
        <option value="RC">RC</option>
        <option value="LC">LC</option>
        <option value="LNC">LNC</option>
      </select>
      <button
        type="button"
        onClick={() => onAssign({ item, slot })}
        disabled={disabled}
        className="px-1.5 py-0.5 text-[10px] bg-[var(--primary)] text-[var(--primary-foreground)] rounded disabled:opacity-50"
      >OK</button>
    </div>
  )
}
