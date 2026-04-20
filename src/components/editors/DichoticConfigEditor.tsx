import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Plus, Mic, Shuffle, Trash2, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { DichoticBlockOrder, DichoticCatchTrials, DichoticCatchPlacement, DichoticScoringGranularity } from '@/types'
import { getListReadiness, type ListReadiness } from '@/lib/packs/readiness'
import { listStimulusLists, listStimuli, getStimulusListByCode } from '@/lib/db/stimuli'
import { InlineListCreator } from './InlineListCreator'
import { PhonemeBalanceChart } from '@/components/PhonemeBalanceChart'
import type { DichoticDigitsParams, DichoticPairDef, Stimulus, StimulusList } from '@/types'

const DICHOTIC_DIGIT_SEED = ['uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'ocho', 'nueve']

export const BLANK_DICHOTIC: DichoticDigitsParams = {
  stimulus_list_code: '',
  num_pairs: 20,
  digits_per_ear: 2,
  isi_ms: 300,
  level_db: 55,
  mode: 'free',
}

interface Props {
  value: DichoticDigitsParams
  onChange: (v: DichoticDigitsParams) => void
  disabled?: boolean
  /** Guarda el test actual y navega a /estímulos con returnTo para volver. */
  onGoToRecord?: (listCode: string) => void
}

export function DichoticConfigEditor({ value, onChange, disabled, onGoToRecord }: Props) {
  const [lists, setLists] = useState<StimulusList[]>([])
  const [readiness, setReadiness] = useState<ListReadiness | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [tokens, setTokens] = useState<string[]>([])

  const refreshLists = () =>
    listStimulusLists().then(all => setLists(all.filter(l => l.category === 'dichotic_digits')))

  useEffect(() => { refreshLists() }, [])

  useEffect(() => {
    if (!value.stimulus_list_code) { setTokens([]); return }
    (async () => {
      const list = await getStimulusListByCode(value.stimulus_list_code)
      if (!list) { setTokens([]); return }
      const its: Stimulus[] = await listStimuli(list.id)
      setTokens(its.map(s => s.token))
    })()
  }, [value.stimulus_list_code])

  const randomize = value.randomize !== false
  const fixedPairs = value.fixed_pairs ?? []

  useEffect(() => {
    if (!value.stimulus_list_code) { setReadiness(null); return }
    getListReadiness(value.stimulus_list_code).then(setReadiness).catch(() => setReadiness(null))
  }, [value.stimulus_list_code])

  const set = <K extends keyof DichoticDigitsParams>(k: K, v: DichoticDigitsParams[K]) => onChange({ ...value, [k]: v })
  const num = (k: keyof DichoticDigitsParams) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const n = e.target.value === '' ? 0 : Number(e.target.value)
    set(k, n as never)
  }

  const emptyPair = (): DichoticPairDef => ({
    left: Array(value.digits_per_ear).fill(''),
    right: Array(value.digits_per_ear).fill(''),
  })

  const updatePair = (idx: number, side: 'left' | 'right', pos: number, tk: string) => {
    const next = fixedPairs.map((p, i) => i === idx ? {
      ...p,
      [side]: p[side].map((t, k) => k === pos ? tk : t),
    } : p)
    onChange({ ...value, fixed_pairs: next })
  }

  const addPair = () => {
    onChange({ ...value, fixed_pairs: [...fixedPairs, emptyPair()] })
  }
  const removePair = (idx: number) => {
    onChange({ ...value, fixed_pairs: fixedPairs.filter((_, i) => i !== idx) })
  }
  const randomFillRow = (idx: number) => {
    if (tokens.length < value.digits_per_ear * 2) return
    const shuffled = [...tokens].sort(() => Math.random() - 0.5)
    const need = value.digits_per_ear * 2
    const pick = shuffled.slice(0, need)
    const next = fixedPairs.map((p, i) => i === idx ? {
      left: pick.slice(0, value.digits_per_ear),
      right: pick.slice(value.digits_per_ear, need),
    } : p)
    onChange({ ...value, fixed_pairs: next })
  }
  const fillAllRandom = () => {
    const rows = value.num_pairs
    const next: DichoticPairDef[] = []
    for (let i = 0; i < rows; i++) {
      if (tokens.length < value.digits_per_ear * 2) { next.push(emptyPair()); continue }
      const shuffled = [...tokens].sort(() => Math.random() - 0.5)
      const need = value.digits_per_ear * 2
      const pick = shuffled.slice(0, need)
      next.push({
        left: pick.slice(0, value.digits_per_ear),
        right: pick.slice(value.digits_per_ear, need),
      })
    }
    onChange({ ...value, fixed_pairs: next })
  }

  return (
    <Card className="mb-4">
      <CardHeader><CardTitle>Parámetros Dichotic Digits</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Lista de estímulos *</Label>
          <div className="flex gap-2">
            <Select
              value={value.stimulus_list_code}
              onChange={e => set('stimulus_list_code', e.target.value)}
              disabled={disabled}
              className="flex-1"
            >
              <option value="">— Elige una lista de dígitos —</option>
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
                <span>Grabada: {readiness.recorded}/{readiness.total} dígitos listos.</span></>
              ) : (
                <><AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                <span>Faltan {readiness.missing} de {readiness.total} grabaciones.</span></>
              )}
              {onGoToRecord ? (
                <button
                  type="button"
                  onClick={() => onGoToRecord(value.stimulus_list_code)}
                  className="inline-flex items-center gap-1 text-[var(--primary)] hover:underline"
                >
                  <Mic className="w-3 h-3" /> Guardar y grabar
                </button>
              ) : null}
            </div>
          )}
          {lists.length === 0 && (
            <p className="text-[10px] text-[var(--muted-foreground)] mt-1">
              No hay listas. Crea una nueva (se cargan 8 dígitos semilla) o instala <code>dichotic-digits-es-v1</code> desde <code>/catalogos</code>.
            </p>
          )}
        </div>

        {tokens.length > 0 && (
          <PhonemeBalanceChart tokens={tokens} expectMonosyllabic />
        )}

        {showCreate && (
          <InlineListCreator
            category="dichotic_digits"
            categoryLabel="Dichotic Digits"
            seedTokens={DICHOTIC_DIGIT_SEED}
            onClose={() => setShowCreate(false)}
            onCreated={async (code) => {
              await refreshLists()
              set('stimulus_list_code', code)
            }}
          />
        )}

        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label>Modo</Label>
            <Select
              value={value.mode}
              onChange={e => set('mode', e.target.value as DichoticDigitsParams['mode'])}
              disabled={disabled}
            >
              <option value="free">Libre (Musiek 1983)</option>
              <option value="directed">Dirigido (Strouse-Wilson 1999)</option>
            </Select>
          </div>
          <div>
            <Label>Pares por sesión</Label>
            <Input type="number" min={1} value={value.num_pairs} onChange={num('num_pairs')} disabled={disabled} />
          </div>
          <div>
            <Label>Dígitos por oído</Label>
            <Input type="number" min={1} max={4} value={value.digits_per_ear} onChange={num('digits_per_ear')} disabled={disabled} />
            <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5">Típico 2 (4 totales por trial)</p>
          </div>
          <div>
            <Label>ISI entre pares (ms)</Label>
            <Input type="number" min={0} value={value.isi_ms} onChange={num('isi_ms')} disabled={disabled} />
          </div>
          <div>
            <Label>Nivel (dB HL)</Label>
            <Input type="number" value={value.level_db} onChange={num('level_db')} disabled={disabled} />
          </div>
        </div>

        <div>
          <Label>Secuencia de pares</Label>
          <div className="flex gap-2 mb-2">
            <button
              type="button"
              onClick={() => onChange({ ...value, randomize: true })}
              disabled={disabled}
              className={`px-3 py-1.5 rounded-md text-sm border ${randomize ? 'bg-[var(--primary)] text-[var(--primary-foreground)] border-[var(--primary)]' : 'border-[var(--border)] hover:bg-[var(--secondary)]'}`}
            >
              <Shuffle className="w-3.5 h-3.5 inline mr-1" /> Aleatoria (runtime)
            </button>
            <button
              type="button"
              onClick={() => onChange({ ...value, randomize: false, fixed_pairs: fixedPairs.length > 0 ? fixedPairs : [emptyPair()] })}
              disabled={disabled}
              className={`px-3 py-1.5 rounded-md text-sm border ${!randomize ? 'bg-[var(--primary)] text-[var(--primary-foreground)] border-[var(--primary)]' : 'border-[var(--border)] hover:bg-[var(--secondary)]'}`}
            >
              Fija (investigador)
            </button>
          </div>

          {!randomize && (
            <div className="border border-[var(--border)] rounded-md p-3 space-y-2">
              {tokens.length === 0 ? (
                <p className="text-xs text-[var(--muted-foreground)]">
                  Primero elige una lista con tokens grabados para poder armar pares fijos.
                </p>
              ) : (
                <>
                  <div className="flex items-center justify-between text-xs text-[var(--muted-foreground)]">
                    <span>{fixedPairs.length} pares definidos (pool: {tokens.length} dígitos).</span>
                    <div className="flex gap-1">
                      <Button type="button" size="sm" variant="ghost" onClick={fillAllRandom} disabled={disabled}>
                        <RefreshCw className="w-3.5 h-3.5" /> Rellenar {value.num_pairs} al azar
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1 max-h-80 overflow-y-auto">
                    {fixedPairs.map((p, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs bg-[var(--secondary)] rounded p-1.5">
                        <span className="w-6 text-center font-mono text-[var(--muted-foreground)]">{idx + 1}</span>
                        <div className="flex gap-1">
                          <span className="text-[10px] font-semibold text-blue-600 self-center pr-1">L</span>
                          {p.left.map((tk, pos) => (
                            <select
                              key={pos}
                              value={tk}
                              onChange={e => updatePair(idx, 'left', pos, e.target.value)}
                              disabled={disabled}
                              className="bg-[var(--card)] border border-[var(--border)] rounded px-1 py-0.5 text-xs"
                            >
                              <option value="">—</option>
                              {tokens.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                          ))}
                        </div>
                        <span className="text-[var(--muted-foreground)]">│</span>
                        <div className="flex gap-1">
                          <span className="text-[10px] font-semibold text-rose-600 self-center pr-1">R</span>
                          {p.right.map((tk, pos) => (
                            <select
                              key={pos}
                              value={tk}
                              onChange={e => updatePair(idx, 'right', pos, e.target.value)}
                              disabled={disabled}
                              className="bg-[var(--card)] border border-[var(--border)] rounded px-1 py-0.5 text-xs"
                            >
                              <option value="">—</option>
                              {tokens.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                          ))}
                        </div>
                        <div className="flex gap-0.5 ml-auto">
                          <button type="button" onClick={() => randomFillRow(idx)} disabled={disabled} className="p-1 hover:bg-[var(--background)] rounded" title="Rellenar al azar">
                            <Shuffle className="w-3 h-3" />
                          </button>
                          <button type="button" onClick={() => removePair(idx)} disabled={disabled} className="p-1 hover:bg-red-500/10 rounded text-red-500" title="Eliminar">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={addPair} disabled={disabled}>
                    <Plus className="w-3.5 h-3.5" /> Agregar par
                  </Button>
                  {fixedPairs.length !== value.num_pairs && (
                    <p className="text-[10px] text-amber-600">
                      Tienes {fixedPairs.length} pares pero el parámetro <code>num_pairs</code> es {value.num_pairs}. Ajusta uno u otro.
                    </p>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <div className="space-y-2">
          {value.mode === 'directed' && (
            <Accordion title="Orden de bloques (directed)">
              <Select
                value={value.directed_block_order ?? 'lrlr'}
                onChange={e => set('directed_block_order', e.target.value as DichoticBlockOrder)}
                disabled={disabled}
              >
                <option value="lrlr">LRLR — alternado trial a trial</option>
                <option value="llrr">LLRR — bloques agrupados (mitad L, mitad R)</option>
                <option value="interleaved">Interleaved (igual a LRLR)</option>
              </Select>
            </Accordion>
          )}

          <Accordion title="Catch trials" badge={value.catch_trials?.enabled ? `${value.catch_trials.count}` : undefined}>
            <CatchTrialsEditor
              value={value.catch_trials ?? null}
              onChange={v => set('catch_trials', v)}
              disabled={disabled}
            />
          </Accordion>

          <Accordion title="Granularidad de scoring" badge={value.scoring_granularity ?? 'per_pair'}>
            <Select
              value={value.scoring_granularity ?? 'per_pair'}
              onChange={e => set('scoring_granularity', e.target.value as DichoticScoringGranularity)}
              disabled={disabled}
            >
              <option value="per_pair">Por par (L/R globales)</option>
              <option value="per_position">Por posición (dígito 1 vs dígito 2 por oído)</option>
              <option value="per_digit">Por dígito individual</option>
            </Select>
            <p className="text-[10px] text-[var(--muted-foreground)] mt-1">
              <code>per_position</code>/<code>per_digit</code> habilitan scoring posicional en el informe.
            </p>
          </Accordion>

          <Accordion title="Instrucciones de práctica" badge={value.practice_instructions_md ? '✓' : undefined}>
            <Textarea
              rows={3}
              value={value.practice_instructions_md ?? ''}
              onChange={e => set('practice_instructions_md', e.target.value)}
              placeholder="# Práctica&#10;Vas a escuchar 2 dígitos en cada oído..."
              disabled={disabled}
              className="font-mono text-xs"
            />
            <p className="text-[10px] text-[var(--muted-foreground)] mt-1">
              Markdown. Se muestra en un modal tras la consigna general, antes del primer par.
            </p>
          </Accordion>
        </div>

        <div className="rounded-md bg-[var(--secondary)] p-3 text-xs text-[var(--muted-foreground)] space-y-2">
          <div>
            <b>Libre (Musiek 1983):</b> paciente repite los 4 dígitos en <i>cualquier orden</i>. Versión clásica, mejor sensibilidad (72–80%) para lesiones corticales temporales y cuerpo calloso. Se administra primero.
          </div>
          <div>
            <b>Dirigido (Strouse-Wilson 1999):</b> el examinador fuerza reportar primero un oído específico (alterna L/R). Activa atención selectiva top-down → más sensible a déficits atencionales (TDAH, post-TEC frontal, envejecimiento cognitivo). Se administra <i>después</i> del libre como baseline.
          </div>
          <div className="text-[10px] opacity-80">
            {randomize
              ? <>Modo <b>aleatorio</b>: pares generados en runtime a partir de los dígitos grabados (sin repetir L↔R dentro del trial). Cada sesión tendrá pares distintos.</>
              : <>Modo <b>fijo</b>: se presentan exactamente los pares que definas abajo, en ese orden. Útil para replicar protocolos publicados o estandarizar entre pacientes.</>
            }
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function Accordion({ title, badge, children }: { title: string; badge?: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-md border border-[var(--border)]">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs font-medium hover:bg-[var(--secondary)]/50"
      >
        {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        <span>{title}</span>
        {badge && <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-[var(--primary)]/10 text-[var(--primary)]">{badge}</span>}
      </button>
      {open && <div className="p-2.5 border-t border-[var(--border)] space-y-2">{children}</div>}
    </div>
  )
}

function CatchTrialsEditor({ value, onChange, disabled }: { value: DichoticCatchTrials | null; onChange: (v: DichoticCatchTrials | null) => void; disabled?: boolean }) {
  const v = value ?? { enabled: false, count: 2, placement: 'random' as DichoticCatchPlacement }
  return (
    <>
      <label className="flex items-center gap-2 text-xs">
        <input type="checkbox" checked={v.enabled} onChange={e => onChange({ ...v, enabled: e.target.checked })} disabled={disabled} />
        Insertar catch trials (pares mono) para validar atención
      </label>
      {v.enabled && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>Cantidad</Label>
            <Input type="number" min={1} value={v.count} onChange={e => onChange({ ...v, count: Number(e.target.value) })} disabled={disabled} />
          </div>
          <div>
            <Label>Colocación</Label>
            <Select value={v.placement} onChange={e => onChange({ ...v, placement: e.target.value as DichoticCatchPlacement })} disabled={disabled}>
              <option value="random">Aleatoria</option>
              <option value="every_n">Cada N pares</option>
              <option value="start_end">Inicio y final</option>
            </Select>
          </div>
        </div>
      )}
      <p className="text-[10px] text-[var(--muted-foreground)]">
        Catch trial = dígitos sólo en un oído. Falla ≥50% = sugiere desatención (no patología auditiva).
      </p>
    </>
  )
}
