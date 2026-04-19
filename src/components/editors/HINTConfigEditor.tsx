import { useEffect, useState } from 'react'
import { Plus, Mic, CheckCircle2, AlertTriangle, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { listStimulusLists, listStimuli, getStimulusListByCode } from '@/lib/db/stimuli'
import { getListReadiness, type ListReadiness } from '@/lib/packs/readiness'
import { InlineListCreator } from './InlineListCreator'
import { PhonemeBalanceChart } from '@/components/PhonemeBalanceChart'
import type { HINTParams, NoiseType, Stimulus, StimulusList } from '@/types'

export const BLANK_HINT: HINTParams = {
  stimulus_list_code: '',
  start_snr_db: 5,
  noise_level_db: 65,
  noise_type: 'pink',
  sentences_per_level: 1,
  threshold_pass_ratio: 0.5,
  step_down_db: 2,
  step_up_db: 2,
  min_snr_db: -15,
  max_snr_db: 20,
  max_total_trials: 30,
}

interface Props {
  value: HINTParams
  onChange: (v: HINTParams) => void
  disabled?: boolean
  onGoToRecord?: (listCode: string) => void
}

function parseKeywords(s: Stimulus): string[] {
  if (!s.keywords_json) return []
  try { const a = JSON.parse(s.keywords_json); return Array.isArray(a) ? a : [] } catch { return [] }
}

export function HINTConfigEditor({ value, onChange, disabled, onGoToRecord }: Props) {
  const [lists, setLists] = useState<StimulusList[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [selectedList, setSelectedList] = useState<StimulusList | null>(null)
  const [items, setItems] = useState<Stimulus[]>([])
  const [readiness, setReadiness] = useState<ListReadiness | null>(null)
  const [showChart, setShowChart] = useState(false)

  const refreshLists = () =>
    listStimulusLists().then(all => setLists(all.filter(l => l.category === 'sentence')))

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

  const set = <K extends keyof HINTParams>(k: K, v: HINTParams[K]) => onChange({ ...value, [k]: v })
  const num = (k: keyof HINTParams) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const n = e.target.value === '' ? 0 : Number(e.target.value)
    set(k, n as never)
  }

  const recordedCount = items.filter(i => i.file_path).length
  const withKeywords = items.filter(i => parseKeywords(i).length > 0).length
  const totalKeywords = items.reduce((acc, i) => acc + parseKeywords(i).length, 0)

  const voiceLevel = value.noise_level_db + value.start_snr_db

  return (
    <Card className="mb-4">
      <CardHeader><CardTitle>Parámetros HINT / SinB</CardTitle></CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,400px)_1fr] gap-5">
          {/* Columna izquierda */}
          <div className="space-y-4">
            <div>
              <Label>Lista de frases *</Label>
              <div className="flex gap-2">
                <Select
                  value={value.stimulus_list_code}
                  onChange={e => set('stimulus_list_code', e.target.value)}
                  disabled={disabled}
                  className="flex-1"
                >
                  <option value="">— Elegí una lista de frases —</option>
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
                    <span>Grabada: {readiness.recorded}/{readiness.total} frases listas.</span></>
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
                  No hay listas de frases. Creá una nueva o instalá <code>hint-es-v1</code> / <code>sharvard-es-v1</code> desde <code>/catalogos</code>.
                </p>
              )}
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
                    <option value="pink">Rosa (HINT clásico)</option>
                    <option value="ssn">SSN — Speech-Shaped (SinB)</option>
                    <option value="white">Blanco</option>
                  </Select>
                </div>
                <div>
                  <Label>Nivel ruido (dB SPL)</Label>
                  <Input type="number" value={value.noise_level_db} onChange={num('noise_level_db')} disabled={disabled} />
                </div>
              </div>
              <p className="text-[10px] text-[var(--muted-foreground)] mt-1">
                Voz inicial = {voiceLevel.toFixed(1)} dB SPL (ruido + SNR inicial). El ruido se mantiene fijo; la voz se ajusta por bracketing.
              </p>
            </div>

            <div className="rounded-md bg-[var(--secondary)] p-2.5 text-[11px] text-[var(--muted-foreground)] space-y-1">
              <div><b>HINT</b> (Nilsson 1994): frase pasa si ≥ <code>pass_ratio</code> de keywords correctos. SNR baja tras pasar, sube tras fallar. SRT-SNR = promedio de los niveles adaptativos tras la primera inversión.</div>
              <div><b>SinB</b> = mismo protocolo con ruido SSN (espectro de habla). Sensible a figura-fondo central más que periférico.</div>
              <div className="text-[10px] opacity-80">Calibrar ruido por tipo en <code>/calibracion §4</code> para SPL exacto; sin ese dato se usa aproximación heurística.</div>
            </div>
          </div>

          {/* Columna derecha */}
          <div className="space-y-3">
            {selectedList ? (
              <div className="border border-[var(--border)] rounded-md p-3 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Frases de la lista</span>
                    {selectedList.is_standard === 1 ? (
                      <Badge variant="outline" className="text-[10px]"><Lock className="w-3 h-3 inline mr-1" /> estándar</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">editable</Badge>
                    )}
                  </div>
                  <div className="text-xs text-[var(--muted-foreground)]">
                    {items.length} frases · {recordedCount} grabadas · {withKeywords} con keywords
                  </div>
                </div>

                <p className="text-[10px] text-[var(--muted-foreground)]">
                  Las frases se editan y las keywords se marcan en <code>/estímulos</code>. El runner HINT sólo incluye frases con audio <b>y</b> al menos una keyword.
                </p>

                {items.length > 0 && (
                  <div className="rounded-md border border-[var(--border)]/40 bg-[var(--secondary)]/30 p-2 text-[11px]">
                    <div className="flex items-center justify-between">
                      <b>Resumen del set</b>
                      <button
                        type="button"
                        onClick={() => setShowChart(v => !v)}
                        className="text-[var(--primary)] hover:underline text-[10px]"
                      >
                        {showChart ? 'Ocultar balance' : 'Ver balance fonémico'}
                      </button>
                    </div>
                    <div className="text-[var(--muted-foreground)] mt-0.5">
                      {totalKeywords} keywords totales · {totalKeywords && items.length ? (totalKeywords / items.length).toFixed(1) : 0} promedio por frase
                    </div>
                  </div>
                )}

                {showChart && items.length > 0 && (
                  <PhonemeBalanceChart tokens={items.map(s => s.token)} />
                )}

                {items.length === 0 ? (
                  <p className="text-xs text-[var(--muted-foreground)] py-2">
                    Lista vacía. Agregá frases en <code>/estímulos</code>.
                  </p>
                ) : (
                  <div className="space-y-1 max-h-[420px] overflow-y-auto">
                    {items.map(s => {
                      const kws = parseKeywords(s)
                      const hasAudio = !!s.file_path
                      const usable = hasAudio && kws.length > 0
                      return (
                        <div
                          key={s.id}
                          className={`flex items-start gap-2 text-xs p-1.5 rounded-md border ${usable ? 'border-emerald-500/30 bg-emerald-500/5' : !hasAudio ? 'border-amber-500/30 bg-amber-500/5' : 'border-[var(--border)]/50 bg-[var(--secondary)]/40'}`}
                        >
                          <span className="font-mono text-[10px] text-[var(--muted-foreground)] w-6 text-right shrink-0">{s.position}.</span>
                          <div className="flex-1 min-w-0">
                            <div className="break-words">{s.token}</div>
                            {kws.length > 0 && (
                              <div className="text-[10px] text-[var(--primary)] mt-0.5">
                                {kws.length} keyword{kws.length > 1 ? 's' : ''}: {kws.join(' · ')}
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-0.5 shrink-0 text-[10px]">
                            {hasAudio
                              ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              : <span className="text-amber-600">sin audio</span>}
                            {kws.length === 0 && <span className="text-amber-600">sin keys</span>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-md border border-dashed border-[var(--border)] p-6 text-center text-xs text-[var(--muted-foreground)]">
                Elegí o creá una lista de frases para ver contenido y grabar.
              </div>
            )}
          </div>
        </div>

        {showCreate && (
          <InlineListCreator
            category="sentence"
            categoryLabel="HINT (frases)"
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
