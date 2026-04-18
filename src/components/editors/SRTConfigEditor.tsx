import { useEffect, useState } from 'react'
import { Plus, Mic, Trash2, CheckCircle2, Lock, ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import type { SRTCarrierPhrase, SRTFamiliarization, SRTMasking, SRTCutoffRule, SRTMethod, NoiseType } from '@/types'
import {
  listStimulusLists, listStimuli, getStimulusListByCode,
  addStimulusToken, deleteStimulus,
} from '@/lib/db/stimuli'
import { InlineListCreator } from './InlineListCreator'
import { TokenInfoDialog } from '@/components/TokenInfoDialog'
import { PhonemeBalanceChart } from '@/components/PhonemeBalanceChart'
import { analyze } from '@/lib/es/phonetics'
import type { SRTParams, Stimulus, StimulusList } from '@/types'

export const BLANK_SRT: SRTParams = {
  stimulus_list_code: '',
  start_level_db: 50,
  words_per_level: 4,
  step_down_db: 10,
  step_up_db: 5,
  min_level_db: 0,
  max_level_db: 90,
  threshold_pass_ratio: 0.5,
  max_total_trials: 40,
}

interface Props {
  value: SRTParams
  onChange: (v: SRTParams) => void
  disabled?: boolean
  onGoToRecord?: (listCode: string) => void
}

export function SRTConfigEditor({ value, onChange, disabled, onGoToRecord }: Props) {
  const [lists, setLists] = useState<StimulusList[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [selectedList, setSelectedList] = useState<StimulusList | null>(null)
  const [items, setItems] = useState<Stimulus[]>([])
  const [newToken, setNewToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [infoStim, setInfoStim] = useState<Stimulus | null>(null)
  const [showChart, setShowChart] = useState(false)

  const refreshLists = () =>
    listStimulusLists().then(all => setLists(all.filter(l => l.category === 'srt')))

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

  const addToken = async () => {
    if (!selectedList) return
    const parts = newToken.split(/[,\n;]+/).map(t => t.trim()).filter(Boolean)
    if (parts.length === 0) return
    setBusy(true)
    try {
      for (const tk of parts) await addStimulusToken(selectedList.id, tk)
      setNewToken('')
      await refreshItems()
    } finally { setBusy(false) }
  }

  // Análisis en vivo del input: si hay coma, muestra cada palabra separada.
  const liveAnalysis = (() => {
    const parts = newToken.split(/[,\n;]+/).map(t => t.trim()).filter(Boolean)
    return parts.map(p => ({ token: p, ...analyze(p) }))
  })()
  const removeToken = async (s: Stimulus) => {
    if (!confirm(`¿Quitar "${s.token}"?`)) return
    await deleteStimulus(s.id)
    await refreshItems()
  }

  const recordedCount = items.filter(i => i.file_path).length

  // Resumen estadístico del set completo
  const summary = (() => {
    if (items.length === 0) return null
    const analyses = items.map(s => analyze(s.token))
    const syllableDist: Record<number, number> = {}
    const stressDist: Record<string, number> = { aguda: 0, llana: 0, esdrujula: 0, sobresdrujula: 0, sin_tonica: 0 }
    const consFreq: Record<string, number> = {}
    const vowelFreq: Record<string, number> = {}
    let withAccent = 0, withDiph = 0, withHiato = 0, issuesCount = 0
    for (const a of analyses) {
      syllableDist[a.syllable_count] = (syllableDist[a.syllable_count] ?? 0) + 1
      const key = a.stress_type ?? 'sin_tonica'
      stressDist[key] = (stressDist[key] ?? 0) + 1
      for (const c of a.consonants) consFreq[c] = (consFreq[c] ?? 0) + 1
      for (const v of a.vowels) vowelFreq[v] = (vowelFreq[v] ?? 0) + 1
      if (a.has_written_accent) withAccent++
      if (a.has_diphthong) withDiph++
      if (a.has_hiato) withHiato++
      if (!a.disilabo) issuesCount++
    }
    const topCons = Object.entries(consFreq).sort((a, b) => b[1] - a[1])
    const topVowels = Object.entries(vowelFreq).sort((a, b) => b[1] - a[1])
    return { total: items.length, syllableDist, stressDist, topCons, topVowels, withAccent, withDiph, withHiato, issuesCount }
  })()

  const set = <K extends keyof SRTParams>(k: K, v: SRTParams[K]) => onChange({ ...value, [k]: v })
  const num = (k: keyof SRTParams) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const n = e.target.value === '' ? 0 : Number(e.target.value)
    set(k, n as never)
  }

  return (
    <Card className="mb-4">
      <CardHeader><CardTitle>Parámetros SRT</CardTitle></CardHeader>
      <CardContent>
       <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,360px)_1fr] gap-5">
        {/* Columna izquierda: selector + params + help */}
        <div className="space-y-4">
        <div>
          <Label>Lista de estímulos *</Label>
          <div className="flex gap-2">
            <Select
              value={value.stimulus_list_code}
              onChange={e => set('stimulus_list_code', e.target.value)}
              disabled={disabled}
              className="flex-1"
            >
              <option value="">— Elegí una lista SRT —</option>
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
          <div className="flex items-center justify-between mt-1">
            <p className="text-[10px] text-[var(--muted-foreground)]">
              Creá una lista vacía y luego grabá tus propios bisílabos.
            </p>
            {onGoToRecord && value.stimulus_list_code && (
              <button
                type="button"
                onClick={() => onGoToRecord(value.stimulus_list_code)}
                className="inline-flex items-center gap-1 text-xs text-[var(--primary)] hover:underline"
              >
                <Mic className="w-3 h-3" /> Guardar y grabar
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Nivel inicial (dB HL)</Label>
            <Input type="number" value={value.start_level_db} onChange={num('start_level_db')} disabled={disabled} />
          </div>
          <div>
            <Label>Palabras por nivel</Label>
            <Input type="number" min={1} value={value.words_per_level} onChange={num('words_per_level')} disabled={disabled} />
          </div>
          <div>
            <Label>Pass ratio (0–1)</Label>
            <Input type="number" step="0.05" min="0" max="1" value={value.threshold_pass_ratio} onChange={num('threshold_pass_ratio')} disabled={disabled} />
          </div>
          <div>
            <Label>Máx. trials</Label>
            <Input type="number" min={1} value={value.max_total_trials ?? 40} onChange={num('max_total_trials')} disabled={disabled} />
          </div>
          <div>
            <Label>Paso bajada (dB)</Label>
            <Input type="number" min={1} value={value.step_down_db} onChange={num('step_down_db')} disabled={disabled} />
          </div>
          <div>
            <Label>Paso subida (dB)</Label>
            <Input type="number" min={1} value={value.step_up_db} onChange={num('step_up_db')} disabled={disabled} />
          </div>
          <div>
            <Label>Piso (dB HL)</Label>
            <Input type="number" value={value.min_level_db} onChange={num('min_level_db')} disabled={disabled} />
          </div>
          <div>
            <Label>Techo (dB HL)</Label>
            <Input type="number" value={value.max_level_db} onChange={num('max_level_db')} disabled={disabled} />
          </div>
        </div>

        <div className="rounded-md bg-[var(--secondary)] p-2.5 text-[11px] text-[var(--muted-foreground)]">
          <b>Método Hughson-Westlake modificado</b> (Carhart-Jerger 1959): nivel desciende <code>step_down</code> dB cuando aciertos ≥ pass ratio; asciende <code>step_up</code> dB si falla. Termina por bracketing, techo/piso o <code>max_trials</code>.
        </div>

        <div className="space-y-2">
          <Accordion title="Método adaptativo">
            <Select
              value={value.method ?? 'hughson_westlake_mod'}
              onChange={e => set('method', e.target.value as SRTMethod)}
              disabled={disabled}
            >
              <option value="hughson_westlake_mod">Hughson-Westlake modificado (Carhart-Jerger 1959)</option>
              <option value="chaiklin_ventry">Chaiklin-Ventry 1964</option>
              <option value="descending_simple">Descendente simple</option>
            </Select>
            <p className="text-[10px] text-[var(--muted-foreground)] mt-1">
              Marcador documental. La lógica usa los parámetros arriba; usa <code>cutoff_rule</code> para cambiar el criterio de corte.
            </p>
          </Accordion>

          <Accordion title="Frase portadora" badge={value.carrier_phrase ? 'activa' : undefined}>
            <CarrierEditor
              value={value.carrier_phrase ?? null}
              onChange={v => set('carrier_phrase', v)}
              availableTokens={items.map(s => s.token)}
              disabled={disabled}
            />
          </Accordion>

          <Accordion title="Familiarización" badge={value.familiarization?.enabled ? 'on' : undefined}>
            <FamiliarizationEditor
              value={value.familiarization ?? null}
              onChange={v => set('familiarization', v)}
              disabled={disabled}
            />
          </Accordion>

          <Accordion title="Enmascaramiento contralateral" badge={value.masking?.enabled ? 'on' : undefined}>
            <MaskingEditor
              value={value.masking ?? null}
              onChange={v => set('masking', v)}
              disabled={disabled}
            />
          </Accordion>

          <Accordion title="Criterio de corte" badge={value.cutoff_rule?.kind ?? 'bracketing'}>
            <CutoffRuleEditor
              value={value.cutoff_rule ?? { kind: 'bracketing' }}
              onChange={v => set('cutoff_rule', v)}
              disabled={disabled}
            />
          </Accordion>
        </div>
        </div>

        {/* Columna derecha: listado + resumen + chart */}
        <div className="space-y-3">
        {selectedList && (
          <div className="border border-[var(--border)] rounded-md p-3 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium">Palabras de la lista</span>
                {selectedList.is_standard === 1 ? (
                  <Badge variant="outline" className="text-[10px]"><Lock className="w-3 h-3 inline mr-1" /> estándar</Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px]">editable</Badge>
                )}
              </div>
              <div className="text-xs text-[var(--muted-foreground)]">
                {items.length} palabras · {recordedCount} grabadas
              </div>
            </div>

            {!editable && items.length > 0 && (
              <p className="text-[10px] text-[var(--muted-foreground)]">
                Lista estándar bloqueada. Si querés modificar palabras, creá una nueva con <b>+ Nueva</b> (podés seedearla copiando estas).
              </p>
            )}

            {editable && (
              <>
                <div className="flex gap-2">
                  <Input
                    placeholder="Agregar palabras (separadas por coma: casa, mesa, perro)"
                    value={newToken}
                    onChange={e => setNewToken(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addToken() } }}
                    disabled={disabled || busy}
                  />
                  <Button type="button" size="sm" onClick={addToken} disabled={disabled || busy || liveAnalysis.length === 0}>
                    <Plus className="w-4 h-4" /> Agregar {liveAnalysis.length > 1 ? `${liveAnalysis.length}` : ''}
                  </Button>
                </div>
                {liveAnalysis.length > 0 && (
                  <div className="mt-2 space-y-1.5 text-[11px] border border-[var(--border)]/60 rounded-md p-2 bg-[var(--secondary)]/40">
                    {liveAnalysis.map((a, i) => (
                      <div key={i} className="space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-sm">
                            {a.syllables.map((syl, si) => (
                              <span key={si} className={si === a.stressed_index ? 'font-bold text-[var(--primary)] underline' : ''}>
                                {si > 0 && <span className="text-[var(--muted-foreground)] no-underline">·</span>}
                                {syl}
                              </span>
                            ))}
                          </span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${a.disilabo ? 'bg-emerald-500/15 text-emerald-700' : 'bg-amber-500/15 text-amber-700'}`}>
                            {a.syllable_count} sílaba{a.syllable_count === 1 ? '' : 's'}
                          </span>
                          {a.stress_type && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--primary)]/10 text-[var(--primary)] font-medium">
                              {a.stress_label}
                            </span>
                          )}
                          {a.has_written_accent && (
                            <span className="text-[10px] text-[var(--muted-foreground)]">con tilde</span>
                          )}
                          {a.has_diphthong && <span className="text-[10px] text-[var(--muted-foreground)]">· diptongo</span>}
                          {a.has_hiato && <span className="text-[10px] text-[var(--muted-foreground)]">· hiato</span>}
                        </div>
                        <div className="flex items-center gap-3 text-[10px] pl-0.5">
                          <span>
                            <span className="text-[var(--muted-foreground)]">Consonantes ({a.consonants.length}):</span>{' '}
                            <span className="font-mono">{a.consonants.length > 0 ? a.consonants.join(' · ') : '—'}</span>
                          </span>
                          <span>
                            <span className="text-[var(--muted-foreground)]">Vocales ({a.vowels.length}):</span>{' '}
                            <span className="font-mono">{a.vowels.length > 0 ? a.vowels.join(' · ') : '—'}</span>
                          </span>
                        </div>
                        {a.issues.length > 0 && !a.disilabo && (
                          <div className="text-[10px] text-amber-600">⚠ {a.issues.join(' · ')}</div>
                        )}
                      </div>
                    ))}
                    <div className="text-[9px] text-[var(--muted-foreground)] pt-1 border-t border-[var(--border)]/40">
                      Clasificación: <b>aguda</b> = tónica en última sílaba · <b>llana/grave</b> = penúltima · <b>esdrújula</b> = antepenúltima · <b>sobresdrújula</b> = anterior.
                      Digrafos <code>ch/ll/rr/qu</code> cuentan como una consonante.
                    </div>
                  </div>
                )}
              </>
            )}

            {summary && (
              <div className="rounded-md border border-[var(--border)]/40 bg-[var(--secondary)]/30 p-2 text-[11px] space-y-1">
                <div className="flex items-center justify-between">
                  <b>Resumen del set</b>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowChart(v => !v)}
                      className="text-[var(--primary)] hover:underline text-[10px]"
                    >
                      {showChart ? 'Ocultar balance' : 'Ver balance fonémico'}
                    </button>
                    <span className="text-[var(--muted-foreground)]">
                      {summary.total} palabras · {recordedCount} grabadas · {summary.issuesCount} no bisílabas
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                  <span>
                    <span className="text-[var(--muted-foreground)]">Sílabas:</span>{' '}
                    {Object.entries(summary.syllableDist).sort((a, b) => Number(a[0]) - Number(b[0])).map(([k, v]) => (
                      <span key={k} className="font-mono">{k}σ:{v} </span>
                    ))}
                  </span>
                  <span>
                    <span className="text-[var(--muted-foreground)]">Acentuación:</span>{' '}
                    {summary.stressDist.aguda > 0 && <span className="font-mono">ag:{summary.stressDist.aguda} </span>}
                    {summary.stressDist.llana > 0 && <span className="font-mono">ll:{summary.stressDist.llana} </span>}
                    {summary.stressDist.esdrujula > 0 && <span className="font-mono">esd:{summary.stressDist.esdrujula} </span>}
                    {summary.stressDist.sobresdrujula > 0 && <span className="font-mono">sob:{summary.stressDist.sobresdrujula} </span>}
                  </span>
                  {summary.withAccent > 0 && <span><span className="text-[var(--muted-foreground)]">con tilde:</span> {summary.withAccent}</span>}
                  {summary.withDiph > 0 && <span><span className="text-[var(--muted-foreground)]">diptongos:</span> {summary.withDiph}</span>}
                  {summary.withHiato > 0 && <span><span className="text-[var(--muted-foreground)]">hiatos:</span> {summary.withHiato}</span>}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                  <span>
                    <span className="text-[var(--muted-foreground)]">Consonantes ({summary.topCons.length} distintas):</span>{' '}
                    {summary.topCons.slice(0, 12).map(([c, n]) => (
                      <span key={c} className="font-mono mr-1">
                        <span className="text-sky-700">{c}</span>
                        <span className="text-[var(--muted-foreground)]">×{n}</span>
                      </span>
                    ))}
                    {summary.topCons.length > 12 && <span className="text-[var(--muted-foreground)]">+{summary.topCons.length - 12} más</span>}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                  <span>
                    <span className="text-[var(--muted-foreground)]">Vocales ({summary.topVowels.length} distintas):</span>{' '}
                    {summary.topVowels.map(([v, n]) => (
                      <span key={v} className="font-mono mr-1">
                        <span className="text-rose-700">{v}</span>
                        <span className="text-[var(--muted-foreground)]">×{n}</span>
                      </span>
                    ))}
                  </span>
                </div>
              </div>
            )}

            {showChart && items.length > 0 && (
              <PhonemeBalanceChart tokens={items.map(s => s.token)} />
            )}

            {items.length === 0 ? (
              <p className="text-xs text-[var(--muted-foreground)] py-2">
                Lista vacía. {editable ? 'Agregá bisílabos arriba.' : ''}
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto">
                {items.map(s => {
                  const a = analyze(s.token)
                  const bad = !a.disilabo
                  const metaTitle = `${a.syllables.join('-')} · ${a.syllable_count} síl. · C${a.consonants.length} V${a.vowels.length}${a.has_diphthong ? ' · diptongo' : ''}${a.has_hiato ? ' · hiato' : ''}`
                  return (
                    <div
                      key={s.id}
                      className={`inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-md text-xs border ${s.file_path ? 'border-emerald-500/40 bg-emerald-500/5' : bad ? 'border-amber-500/40 bg-amber-500/5' : 'border-[var(--border)]/50 bg-[var(--secondary)]'}`}
                      title={`${metaTitle}${s.file_path ? ` · ${s.duration_ms} ms · ${s.rms_dbfs?.toFixed(1)} dBFS` : ' · sin audio'}`}
                    >
                      <button
                        type="button"
                        onClick={() => setInfoStim(s)}
                        className="inline-flex items-center gap-1 hover:underline"
                      >
                        <span className="font-mono text-[10px] text-[var(--muted-foreground)]">{s.position}.</span>
                        <span>{s.token}</span>
                        <span className="text-[9px] text-[var(--muted-foreground)]">({a.syllable_count}σ · {a.stress_type ?? '—'})</span>
                        {bad && <span className="text-amber-600 text-[10px]">⚠</span>}
                        {s.file_path && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                      </button>
                      {editable && !disabled && (
                        <button type="button" onClick={() => removeToken(s)} className="hover:text-red-500 pl-1">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {!selectedList && (
          <div className="rounded-md border border-dashed border-[var(--border)] p-6 text-center text-xs text-[var(--muted-foreground)]">
            Elegí o creá una lista para ver y editar las palabras.
          </div>
        )}
        </div>
       </div>

       {showCreate && (
         <InlineListCreator
           category="srt"
           categoryLabel="SRT (bisílabos)"
           onClose={() => setShowCreate(false)}
           onCreated={async (code) => {
             await refreshLists()
             set('stimulus_list_code', code)
           }}
         />
       )}

       {infoStim && (
         <TokenInfoDialog
           stimulus={infoStim}
           onClose={() => setInfoStim(null)}
         />
       )}
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

function CarrierEditor({ value, onChange, availableTokens, disabled }: { value: SRTCarrierPhrase | null; onChange: (v: SRTCarrierPhrase | null) => void; availableTokens: string[]; disabled?: boolean }) {
  const enabled = !!value
  return (
    <>
      <label className="flex items-center gap-2 text-xs">
        <input type="checkbox" checked={enabled} onChange={e => onChange(e.target.checked ? { audio_token: availableTokens[0] ?? '', lead_in_ms: 500 } : null)} disabled={disabled} />
        Reproducir frase portadora antes de cada palabra
      </label>
      {enabled && value && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>Token portador</Label>
            <Select value={value.audio_token} onChange={e => onChange({ ...value, audio_token: e.target.value })} disabled={disabled}>
              <option value="">— elegir —</option>
              {availableTokens.map(t => <option key={t} value={t}>{t}</option>)}
            </Select>
          </div>
          <div>
            <Label>Pausa tras portadora (ms)</Label>
            <Input type="number" min={0} value={value.lead_in_ms} onChange={e => onChange({ ...value, lead_in_ms: Number(e.target.value) })} disabled={disabled} />
          </div>
        </div>
      )}
      <p className="text-[10px] text-[var(--muted-foreground)]">
        Token debe existir en la lista (ej. "diga", "repita"). Grabalo como un estímulo más.
      </p>
    </>
  )
}

function FamiliarizationEditor({ value, onChange, disabled }: { value: SRTFamiliarization | null; onChange: (v: SRTFamiliarization | null) => void; disabled?: boolean }) {
  const v = value ?? { enabled: false, level_db: 70, show_list: false, count: 3 }
  return (
    <>
      <label className="flex items-center gap-2 text-xs">
        <input type="checkbox" checked={v.enabled} onChange={e => onChange({ ...v, enabled: e.target.checked })} disabled={disabled} />
        Fase de familiarización antes del test
      </label>
      {v.enabled && (
        <div className="grid grid-cols-3 gap-2">
          <div>
            <Label>Nivel demo (dB HL)</Label>
            <Input type="number" value={v.level_db} onChange={e => onChange({ ...v, level_db: Number(e.target.value) })} disabled={disabled} />
          </div>
          <div>
            <Label>Palabras demo</Label>
            <Input type="number" min={1} value={v.count ?? 3} onChange={e => onChange({ ...v, count: Number(e.target.value) })} disabled={disabled} />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={v.show_list} onChange={e => onChange({ ...v, show_list: e.target.checked })} disabled={disabled} />
              Mostrar palabras
            </label>
          </div>
        </div>
      )}
    </>
  )
}

function MaskingEditor({ value, onChange, disabled }: { value: SRTMasking | null; onChange: (v: SRTMasking | null) => void; disabled?: boolean }) {
  const v = value ?? { enabled: false, noise_type: 'ssn' as NoiseType, offset_db: 30, follow_level: true }
  return (
    <>
      <label className="flex items-center gap-2 text-xs">
        <input type="checkbox" checked={v.enabled} onChange={e => onChange({ ...v, enabled: e.target.checked })} disabled={disabled} />
        Enmascaramiento contralateral
      </label>
      {v.enabled && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Tipo ruido</Label>
              <Select value={v.noise_type} onChange={e => onChange({ ...v, noise_type: e.target.value as NoiseType })} disabled={disabled}>
                <option value="ssn">SSN (speech-shaped)</option>
                <option value="pink">Rosa</option>
                <option value="white">Blanco</option>
                <option value="narrow">Banda angosta</option>
              </Select>
            </div>
            <div>
              <Label>Offset (dB bajo signal)</Label>
              <Input type="number" value={v.offset_db} onChange={e => onChange({ ...v, offset_db: Number(e.target.value) })} disabled={disabled} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={v.follow_level} onChange={e => onChange({ ...v, follow_level: e.target.checked })} disabled={disabled} />
            Máscara sigue al signal nivel-por-nivel
          </label>
          <p className="text-[10px] text-[var(--muted-foreground)]">
            Requiere oído monaural (L o R). Sin efecto en modo binaural.
          </p>
        </>
      )}
    </>
  )
}

function CutoffRuleEditor({ value, onChange, disabled }: { value: SRTCutoffRule; onChange: (v: SRTCutoffRule) => void; disabled?: boolean }) {
  return (
    <>
      <Select
        value={value.kind}
        onChange={e => {
          const k = e.target.value as SRTCutoffRule['kind']
          if (k === 'bracketing') onChange({ kind: 'bracketing' })
          else if (k === 'fixed_trials') onChange({ kind: 'fixed_trials', trials: 20 })
          else onChange({ kind: 'plateau', consecutive_levels: 3, delta_db: 5 })
        }}
        disabled={disabled}
      >
        <option value="bracketing">Bracketing (default)</option>
        <option value="fixed_trials">Trials fijos</option>
        <option value="plateau">Plateau (consecutivos dentro de Δ dB)</option>
      </Select>
      {value.kind === 'fixed_trials' && (
        <div>
          <Label>Trials totales</Label>
          <Input type="number" min={1} value={value.trials} onChange={e => onChange({ kind: 'fixed_trials', trials: Number(e.target.value) })} disabled={disabled} />
        </div>
      )}
      {value.kind === 'plateau' && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>Niveles consecutivos</Label>
            <Input type="number" min={2} value={value.consecutive_levels} onChange={e => onChange({ ...value, consecutive_levels: Number(e.target.value) })} disabled={disabled} />
          </div>
          <div>
            <Label>Δ máximo (dB)</Label>
            <Input type="number" min={1} value={value.delta_db} onChange={e => onChange({ ...value, delta_db: Number(e.target.value) })} disabled={disabled} />
          </div>
        </div>
      )}
    </>
  )
}
