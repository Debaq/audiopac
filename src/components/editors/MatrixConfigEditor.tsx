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
import { getListReadiness, type ListReadiness } from '@/lib/packs/readiness'
import { InlineListCreator } from './InlineListCreator'
import { PhonemeBalanceChart } from '@/components/PhonemeBalanceChart'
import type { MatrixParams, NoiseType, Stimulus, StimulusList } from '@/types'

const DEFAULT_COLUMN_LABELS = ['Nombre', 'Verbo', 'Número', 'Objeto', 'Adjetivo']

export const BLANK_MATRIX: MatrixParams = {
  stimulus_list_code: '',
  columns: 5,
  start_snr_db: 0,
  noise_level_db: 65,
  noise_type: 'ssn',
  inter_word_gap_ms: 80,
  sentences_per_level: 1,
  threshold_pass_ratio: 0.6,
  step_down_db: 2,
  step_up_db: 2,
  min_snr_db: -20,
  max_snr_db: 15,
  max_total_trials: 30,
}

interface Props {
  value: MatrixParams
  onChange: (v: MatrixParams) => void
  disabled?: boolean
  onGoToRecord?: (listCode: string) => void
}

function columnOf(s: Stimulus): number | null {
  const meta = parseStimMetadata(s)
  const c = meta.column
  return typeof c === 'number' && Number.isFinite(c) ? c : null
}

export function MatrixConfigEditor({ value, onChange, disabled, onGoToRecord }: Props) {
  const [lists, setLists] = useState<StimulusList[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [selectedList, setSelectedList] = useState<StimulusList | null>(null)
  const [items, setItems] = useState<Stimulus[]>([])
  const [readiness, setReadiness] = useState<ListReadiness | null>(null)
  const [busy, setBusy] = useState(false)

  const refreshLists = () =>
    listStimulusLists().then(all => setLists(all.filter(l => l.category === 'matrix')))

  const refreshItems = async () => {
    if (!value.stimulus_list_code) { setSelectedList(null); setItems([]); return }
    const list = await getStimulusListByCode(value.stimulus_list_code)
    setSelectedList(list)
    if (!list) { setItems([]); return }
    setItems(await listStimuli(list.id))
  }

  useEffect(() => { refreshLists() }, [])
  useEffect(() => { refreshItems() }, [value.stimulus_list_code])
  useEffect(() => {
    if (!value.stimulus_list_code) { setReadiness(null); return }
    getListReadiness(value.stimulus_list_code).then(setReadiness).catch(() => setReadiness(null))
  }, [value.stimulus_list_code])

  const editable = !!selectedList && selectedList.is_standard !== 1

  const set = <K extends keyof MatrixParams>(k: K, v: MatrixParams[K]) => onChange({ ...value, [k]: v })
  const num = (k: keyof MatrixParams) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const n = e.target.value === '' ? 0 : Number(e.target.value)
    set(k, n as never)
  }

  const assignColumn = async (stim: Stimulus, col: number | null) => {
    if (!editable) return
    setBusy(true)
    try {
      const meta = parseStimMetadata(stim)
      if (col === null) delete meta.column
      else meta.column = col
      await updateStimulusMetadata(stim.id, meta)
      await refreshItems()
    } finally { setBusy(false) }
  }

  const autoAssign = async () => {
    if (!editable) return
    if (!confirm('Asignar columnas en secuencia 0,1,2,… ciclando (orden actual de la lista)?')) return
    setBusy(true)
    try {
      for (let i = 0; i < items.length; i++) {
        const s = items[i]
        const meta = parseStimMetadata(s)
        meta.column = i % value.columns
        await updateStimulusMetadata(s.id, meta)
      }
      await refreshItems()
    } finally { setBusy(false) }
  }

  const byColumn: Stimulus[][] = Array.from({ length: value.columns }, () => [])
  const unassigned: Stimulus[] = []
  for (const s of items) {
    const c = columnOf(s)
    if (c !== null && c >= 0 && c < value.columns) byColumn[c].push(s)
    else unassigned.push(s)
  }
  const columnLabels = Array.from({ length: value.columns }, (_, i) => DEFAULT_COLUMN_LABELS[i] ?? `Col ${i + 1}`)

  const voiceLevel = value.noise_level_db + value.start_snr_db

  return (
    <Card className="mb-4">
      <CardHeader><CardTitle>Parámetros Matrix 5-AFC</CardTitle></CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,400px)_1fr] gap-5">
          {/* Columna izquierda */}
          <div className="space-y-4">
            <div>
              <Label>Lista Matrix *</Label>
              <div className="flex gap-2">
                <Select
                  value={value.stimulus_list_code}
                  onChange={e => set('stimulus_list_code', e.target.value)}
                  disabled={disabled}
                  className="flex-1"
                >
                  <option value="">— Elige una lista Matrix —</option>
                  {lists.map(l => (
                    <option key={l.id} value={l.code}>
                      {l.name} ({l.code})
                    </option>
                  ))}
                </Select>
                <Button type="button" variant="outline" size="sm" onClick={() => setShowCreate(true)} disabled={disabled}>
                  <Plus className="w-4 h-4" /> Nueva
                </Button>
              </div>
              {readiness && (
                <div className="mt-2 flex items-center gap-2 text-xs">
                  {readiness.missing === 0 ? (
                    <><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span>{readiness.recorded}/{readiness.total} palabras grabadas.</span></>
                  ) : (
                    <><AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                    <span>Faltan {readiness.missing} de {readiness.total} grabaciones.</span></>
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
                  No hay listas Matrix. Crea una nueva o instala <code>matrix-es-v1</code> desde <code>/catalogos</code>.
                </p>
              )}
            </div>

            <div>
              <Label className="text-xs font-semibold">Estructura</Label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Columnas</Label>
                  <Input type="number" min={2} max={7} value={value.columns} onChange={num('columns')} disabled={disabled} />
                  <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5">Típico: 5 (Nombre, Verbo, Número, Objeto, Adjetivo).</p>
                </div>
                <div>
                  <Label>Gap inter-palabra (ms)</Label>
                  <Input type="number" min={0} value={value.inter_word_gap_ms} onChange={num('inter_word_gap_ms')} disabled={disabled} />
                </div>
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold">SNR adaptativo</Label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>SNR inicial (dB)</Label>
                  <Input type="number" value={value.start_snr_db} onChange={num('start_snr_db')} disabled={disabled} />
                </div>
                <div>
                  <Label>Frases por nivel</Label>
                  <Input type="number" min={1} value={value.sentences_per_level} onChange={num('sentences_per_level')} disabled={disabled} />
                </div>
                <div>
                  <Label>Pass ratio (0–1)</Label>
                  <Input type="number" step="0.05" min="0" max="1" value={value.threshold_pass_ratio} onChange={num('threshold_pass_ratio')} disabled={disabled} />
                  <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5">0.6 = 3/5 aciertos por frase.</p>
                </div>
                <div>
                  <Label>Máx. trials</Label>
                  <Input type="number" min={1} value={value.max_total_trials ?? 30} onChange={num('max_total_trials')} disabled={disabled} />
                </div>
                <div>
                  <Label>Paso bajada (dB)</Label>
                  <Input type="number" min={0.5} step="0.5" value={value.step_down_db} onChange={num('step_down_db')} disabled={disabled} />
                </div>
                <div>
                  <Label>Paso subida (dB)</Label>
                  <Input type="number" min={0.5} step="0.5" value={value.step_up_db} onChange={num('step_up_db')} disabled={disabled} />
                </div>
                <div>
                  <Label>SNR mínimo (piso)</Label>
                  <Input type="number" value={value.min_snr_db} onChange={num('min_snr_db')} disabled={disabled} />
                </div>
                <div>
                  <Label>SNR máximo (techo)</Label>
                  <Input type="number" value={value.max_snr_db} onChange={num('max_snr_db')} disabled={disabled} />
                </div>
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold">Ruido enmascarante</Label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Tipo</Label>
                  <Select
                    value={value.noise_type}
                    onChange={e => set('noise_type', e.target.value as NoiseType)}
                    disabled={disabled}
                  >
                    <option value="ssn">SSN — Speech-Shaped (Hochmuth 2012)</option>
                    <option value="pink">Rosa</option>
                    <option value="white">Blanco</option>
                  </Select>
                </div>
                <div>
                  <Label>Nivel ruido (dB SPL)</Label>
                  <Input type="number" value={value.noise_level_db} onChange={num('noise_level_db')} disabled={disabled} />
                </div>
              </div>
              <p className="text-[10px] text-[var(--muted-foreground)] mt-1">
                Voz inicial = {voiceLevel.toFixed(1)} dB SPL. Ruido continuo; voz concatena palabras con gap.
              </p>
            </div>

            <div className="rounded-md bg-[var(--secondary)] p-2.5 text-[11px] text-[var(--muted-foreground)] space-y-1">
              <div><b>Matrix</b> (Hochmuth 2012, Kollmeier): frase sintética de {value.columns} palabras (una por columna). El paciente elige de un grid {value.columns}×10. Altamente reproducible (test-retest ±1 dB).</div>
              <div>Pass si ≥ <code>pass_ratio</code> palabras correctas. SNR se adapta por bracketing hasta SRT-SNR.</div>
            </div>
          </div>

          {/* Columna derecha: asignación de columnas */}
          <div className="space-y-3">
            {selectedList ? (
              <div className="border border-[var(--border)] rounded-md p-3 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Asignación de columnas</span>
                    {selectedList.is_standard === 1 ? (
                      <Badge variant="outline" className="text-[10px]"><Lock className="w-3 h-3 inline mr-1" /> estándar</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">editable</Badge>
                    )}
                  </div>
                  <div className="text-xs text-[var(--muted-foreground)]">
                    {items.length} palabras · {items.length - unassigned.length} asignadas · {unassigned.length} sin columna
                  </div>
                </div>

                {editable && (
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={autoAssign} disabled={disabled || busy || items.length === 0}>
                      Asignar en secuencia
                    </Button>
                    <p className="text-[10px] text-[var(--muted-foreground)] self-center">
                      Cicla 0,1,2,…,{value.columns - 1},0,1,… sobre el orden actual. Útil como punto de partida.
                    </p>
                  </div>
                )}

                {!editable && (
                  <p className="text-[10px] text-[var(--muted-foreground)]">
                    Lista estándar bloqueada. Duplica si quieres re-asignar columnas.
                  </p>
                )}

                <div className="grid grid-cols-1 md:grid-cols-5 gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(value.columns, 5)}, minmax(0, 1fr))` }}>
                  {byColumn.map((toks, ci) => {
                    const recorded = toks.filter(t => t.file_path).length
                    const missing = toks.length === 0
                    return (
                      <div key={ci} className={`border rounded-md p-2 min-h-[220px] ${missing ? 'border-amber-500/40 bg-amber-500/5' : 'border-[var(--border)]'}`}>
                        <div className="text-[11px] font-semibold mb-1 flex items-center justify-between">
                          <span>{columnLabels[ci]}</span>
                          <span className="text-[9px] text-[var(--muted-foreground)] font-normal">
                            {toks.length} · {recorded}/{toks.length} rec
                          </span>
                        </div>
                        {missing && <p className="text-[10px] text-amber-600">vacía</p>}
                        <div className="space-y-1">
                          {toks.map(t => (
                            <TokenRow
                              key={t.id}
                              stim={t}
                              columns={value.columns}
                              currentCol={ci}
                              labels={columnLabels}
                              onChange={c => assignColumn(t, c)}
                              disabled={!editable || disabled || busy}
                            />
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {unassigned.length > 0 && (
                  <div className="border border-amber-500/40 bg-amber-500/5 rounded-md p-2">
                    <div className="text-[11px] font-semibold mb-1 text-amber-700">
                      Sin columna asignada ({unassigned.length})
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {unassigned.map(t => (
                        <TokenRow
                          key={t.id}
                          stim={t}
                          columns={value.columns}
                          currentCol={null}
                          labels={columnLabels}
                          onChange={c => assignColumn(t, c)}
                          disabled={!editable || disabled || busy}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {items.length === 0 && (
                  <p className="text-xs text-[var(--muted-foreground)] py-2">
                    Lista vacía. Agrega palabras en <code>/estímulos</code>.
                  </p>
                )}

                {items.length > 0 && (
                  <>
                    <PhonemeBalanceChart tokens={items.map(s => s.token)} />
                    <MatrixPerColumnStats byColumn={byColumn} labels={columnLabels} />
                  </>
                )}
              </div>
            ) : (
              <div className="rounded-md border border-dashed border-[var(--border)] p-6 text-center text-xs text-[var(--muted-foreground)]">
                Elige o crea una lista Matrix para asignar columnas.
              </div>
            )}
          </div>
        </div>

        {showCreate && (
          <InlineListCreator
            category="matrix"
            categoryLabel="Matrix"
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

function MatrixPerColumnStats({ byColumn, labels }: { byColumn: Stimulus[][]; labels: string[] }) {
  return (
    <div className="rounded-md border border-[var(--border)]/40 bg-[var(--secondary)]/20 p-2 text-[10px] space-y-0.5">
      <div className="font-semibold text-[11px] mb-1">Balance por columna (longitud / variedad)</div>
      {byColumn.map((toks, ci) => {
        if (toks.length === 0) return <div key={ci} className="text-amber-600">{labels[ci]}: vacía</div>
        const lens = toks.map(t => t.token.length)
        const minL = Math.min(...lens), maxL = Math.max(...lens)
        const uniqInitials = new Set(toks.map(t => t.token[0]?.toLowerCase() ?? '')).size
        return (
          <div key={ci} className="flex gap-3">
            <span className="font-semibold w-20">{labels[ci]}</span>
            <span className="text-[var(--muted-foreground)]">{toks.length} tokens</span>
            <span className="text-[var(--muted-foreground)]">longitud {minL}-{maxL} chars</span>
            <span className="text-[var(--muted-foreground)]">{uniqInitials} iniciales distintas</span>
          </div>
        )
      })}
      <div className="text-[9px] text-[var(--muted-foreground)] pt-1 border-t border-[var(--border)]/40">
        Matrix idealmente: 10 tokens/col, longitud similar entre columnas, iniciales variadas para forzar discriminación.
      </div>
    </div>
  )
}

function TokenRow({ stim, columns, currentCol, labels, onChange, disabled }: {
  stim: Stimulus
  columns: number
  currentCol: number | null
  labels: string[]
  onChange: (col: number | null) => void
  disabled?: boolean
}) {
  return (
    <div className={`flex items-center gap-1 text-xs px-1.5 py-0.5 rounded border ${stim.file_path ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-[var(--border)]/50 bg-[var(--secondary)]/40'}`}>
      <span className="font-mono text-[9px] text-[var(--muted-foreground)] w-6 text-right">{stim.position}.</span>
      <span className="flex-1 truncate">{stim.token}</span>
      {stim.file_path && <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />}
      <select
        value={currentCol ?? ''}
        onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))}
        disabled={disabled}
        className="bg-[var(--card)] border border-[var(--border)] rounded px-1 py-0.5 text-[10px]"
      >
        <option value="">—</option>
        {Array.from({ length: columns }, (_, i) => (
          <option key={i} value={i}>{labels[i] ?? `Col ${i + 1}`}</option>
        ))}
      </select>
    </div>
  )
}
