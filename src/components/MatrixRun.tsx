import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Play, StopCircle, AlertTriangle, Flag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { finishSession, cancelSession, saveResponse, listResponses } from '@/lib/db/sessions'
import { getStimulusListByCode, listStimuli } from '@/lib/db/stimuli'
import { MatrixController, type MatrixState } from '@/lib/audio/matrixRunner'
import { ensureRunning, type CalibCurvePoint } from '@/lib/audio/engine'
import { PreviewBanner } from '@/components/PreviewBanner'
import type { TestSession, TestTemplateParsed, Patient, MatrixParams } from '@/types'
import { cn } from '@/lib/utils'

interface Props {
  session: TestSession
  template: TestTemplateParsed
  patient: Patient
  params: MatrixParams
  preview?: boolean
}

const COLUMN_LABELS = ['Nombre', 'Verbo', 'Número', 'Objeto', 'Adjetivo']

export function MatrixRun({ session, template, patient, params, preview = false }: Props) {
  const navigate = useNavigate()
  const sid = session.id

  const [loadError, setLoadError] = useState<string | null>(null)
  const ctrlRef = useRef<MatrixController | null>(null)
  const [state, setState] = useState<MatrixState | null>(null)
  const [notes, setNotes] = useState('')
  const [finishing, setFinishing] = useState(false)
  const [selected, setSelected] = useState<(string | null)[]>([])
  const [columnTokens, setColumnTokens] = useState<string[][]>([])

  useEffect(() => {
    (async () => {
      const list = await getStimulusListByCode(params.stimulus_list_code)
      if (!list) { setLoadError(`Lista no encontrada: ${params.stimulus_list_code}`); return }
      const items = await listStimuli(list.id)
      let curve: CalibCurvePoint[] | undefined
      if (session.calibration_curve_snapshot) {
        try { curve = JSON.parse(session.calibration_curve_snapshot) } catch { /* noop */ }
      }
      const ctrl = new MatrixController(params, items, session.ear, session.ref_db_snapshot ?? undefined, curve, preview)
      if (!preview && !ctrl.columnsReady()) {
        const miss = ctrl.missingColumns()
        setLoadError(`Faltan grabaciones en columna(s) ${miss.map(i => COLUMN_LABELS[i] ?? i).join(', ')}. Revisá /estimulos — cada palabra necesita metadata.column asignado.`)
        return
      }
      if (preview && !ctrl.columnsReady()) {
        const miss = ctrl.missingColumns()
        setLoadError(`Lista sin metadata.column en columna(s): ${miss.map(i => COLUMN_LABELS[i] ?? i).join(', ')}. Asigná metadata para preview.`)
        return
      }
      ctrlRef.current = ctrl
      setColumnTokens(Array.from({ length: params.columns }, (_, i) => ctrl.columnTokens(i)))
      const prev = preview ? [] : await listResponses(sid)
      if (prev.length > 0) {
        ctrl.hydrate(prev.map(r => ({
          item_index: r.item_index,
          expected_pattern: r.expected_pattern,
          given_pattern: r.given_pattern,
          is_correct: r.is_correct,
        })))
      }
      setState({ ...ctrl.state })
      setSelected(Array(params.columns).fill(null))
      const unsub = ctrl.subscribe(setState)
      return () => { unsub() }
    })()
  }, [sid])

  const pending = useMemo(() => {
    if (!state) return null
    return state.trials.find(t => t.pass === undefined && t.snr_db === state.currentSnr) ?? null
  }, [state])

  const currentLvlStat = useMemo(() => {
    if (!state) return null
    return state.levelStats.find(s => s.snr_db === state.currentSnr) ?? { snr_db: state.currentSnr, presented: 0, passed: 0, completed: false }
  }, [state])

  const ensureTrial = () => {
    const c = ctrlRef.current
    if (!c || c.state.finished) return null
    return c.pendingTrial() ?? c.prepareNext()
  }

  const handlePlay = async () => {
    const c = ctrlRef.current
    if (!c || c.state.finished || c.state.isPlaying) return
    await ensureRunning()
    const trial = ensureTrial()
    if (!trial) return
    setSelected(Array(params.columns).fill(null))
    await c.play(trial)
  }

  const pickCol = (col: number, token: string) => {
    setSelected(prev => {
      const next = prev.slice()
      next[col] = next[col] === token ? null : token
      return next
    })
  }

  const handleSubmit = async () => {
    const c = ctrlRef.current
    if (!c || c.state.isPlaying) return
    const t = c.pendingTrial()
    if (!t) return
    c.answer(selected)
    if (!preview) {
      await saveResponse({
        session_id: sid,
        item_index: t.index,
        phase: 'test',
        expected_pattern: `S${t.snr_db}|${t.expected.join('|')}`,
        given_pattern: selected.map(s => s ?? '').join('|'),
        is_correct: ((t.correct_count ?? 0) / t.expected.length) >= params.threshold_pass_ratio,
        reaction_time_ms: t.presented_at ? Date.now() - t.presented_at : null,
      })
    }
    setSelected(Array(params.columns).fill(null))
  }

  const handleCancel = async () => {
    if (preview) { navigate(`/tests?id=${template.id}`); return }
    if (!confirm('¿Cancelar evaluación?')) return
    await cancelSession(sid)
    navigate('/evaluacion')
  }

  const handleFinishManual = () => {
    if (!ctrlRef.current) return
    if (!confirm('¿Terminar ahora? SRT-SNR se calcula con los datos actuales.')) return
    ctrlRef.current.finishManual()
  }

  const handleSave = async () => {
    const c = ctrlRef.current
    if (!c) return
    if (preview) { navigate(`/tests?id=${template.id}`); return }
    setFinishing(true)
    try {
      const scored = c.state.trials.filter(t => t.pass !== undefined)
      const correctWords = scored.reduce((a, t) => a + (t.correct_count ?? 0), 0)
      const totalWords = scored.length * params.columns
      const srt = c.state.srtSnrDb
      const prefix = srt !== null ? `SRT-SNR estimado: ${srt} dB. ` : `SRT-SNR no determinado (${c.state.ended_reason ?? 'sin datos'}). `
      await finishSession(sid, {
        practice_score: 0,
        test_score: totalWords > 0 ? correctWords / totalWords : 0,
        total_items: totalWords,
        correct_items: correctWords,
        notes: prefix + (notes || ''),
      })
      navigate(`/informes/${sid}`)
    } finally {
      setFinishing(false)
    }
  }

  if (loadError) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
              <AlertTriangle className="w-5 h-5" /> No se puede iniciar Matrix
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>{loadError}</p>
            <div className="flex gap-2">
              <Button onClick={() => navigate('/estimulos')}>Ir a Estudio</Button>
              <Button variant="outline" onClick={handleCancel}>Cancelar sesión</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!state) return <div className="p-8">Cargando Matrix...</div>

  const voiceLevel = params.noise_level_db + state.currentSnr
  const allPicked = selected.every(s => s !== null)

  return (
    <div className="min-h-screen">
      <div className="p-8 max-w-6xl mx-auto">
        {preview && <PreviewBanner />}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-3xl font-black tracking-tight">{template.name}</h1>
            <p className="text-[var(--muted-foreground)]">
              {patient.last_name}, {patient.first_name} · Oído: <span className="font-medium capitalize">{session.ear}</span> · Matrix 5-AFC
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleCancel}>
            <StopCircle className="w-4 h-4" /> Cancelar
          </Button>
        </div>

        <div className="grid grid-cols-4 gap-3 mb-6">
          <StatTile label="SNR actual" value={`${state.currentSnr} dB`} accent />
          <StatTile label="Voz / Ruido" value={`${voiceLevel} / ${params.noise_level_db}`} />
          <StatTile label="En nivel" value={`${currentLvlStat?.presented ?? 0}/${params.sentences_per_level}`} />
          <StatTile label="SRT-SNR" value={state.srtSnrDb !== null ? `${state.srtSnrDb} dB` : '—'} big />
        </div>

        {!state.finished && (
          <Card className="mb-6 border-2 border-[var(--primary)]/20">
            <div className="h-1 bg-[var(--primary)]" />
            <CardContent className="p-6">
              <div className="text-center mb-4">
                <div className="text-xs uppercase tracking-widest text-[var(--muted-foreground)] mb-1">
                  {pending ? 'Marcá 1 palabra por columna que escuchaste' : 'Pulsá reproducir para una nueva frase'}
                </div>
                {pending && (
                  <div className="text-xs text-[var(--muted-foreground)]">
                    Seleccionadas: {selected.filter(Boolean).length}/{params.columns}
                  </div>
                )}
              </div>

              <div
                className="grid gap-2 mb-4"
                style={{ gridTemplateColumns: `repeat(${params.columns}, minmax(0, 1fr))` }}
              >
                {columnTokens.map((tokens, ci) => (
                  <div key={ci} className="flex flex-col gap-1">
                    <div className="text-[10px] uppercase tracking-wider text-[var(--muted-foreground)] font-bold text-center mb-1">
                      {COLUMN_LABELS[ci] ?? `Col ${ci + 1}`}
                    </div>
                    {tokens.map(tok => {
                      const isSel = selected[ci] === tok
                      return (
                        <button
                          key={tok}
                          disabled={!pending}
                          onClick={() => pickCol(ci, tok)}
                          className={cn(
                            'w-full text-sm py-2 px-2 rounded-md border-2 transition-all text-center',
                            !pending && 'border-transparent text-[var(--muted-foreground)] cursor-default opacity-50',
                            pending && !isSel && 'border-[var(--border)] hover:border-[var(--primary)]/50',
                            isSel && 'border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold',
                          )}
                        >{tok}</button>
                      )
                    })}
                  </div>
                ))}
              </div>

              <div className="flex gap-3 justify-center flex-wrap">
                <Button size="xl" onClick={handlePlay} disabled={state.isPlaying || !!pending} className="min-w-[200px]">
                  <Play className="w-5 h-5" /> {state.isPlaying ? 'Reproduciendo...' : pending ? 'Esperando respuesta' : 'Reproducir frase'}
                </Button>
                <Button size="xl" onClick={handleSubmit} disabled={!pending || !allPicked || state.isPlaying} className="bg-emerald-600 hover:bg-emerald-700 text-white min-w-[180px]">
                  Confirmar
                </Button>
              </div>

              <div className="text-center mt-4">
                <Button variant="ghost" size="sm" onClick={handleFinishManual}>
                  <Flag className="w-4 h-4" /> Terminar y calcular SRT-SNR
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Progreso por SNR</CardTitle>
            <CardDescription>
              Pasa si ≥{Math.round(params.threshold_pass_ratio * 100)}% palabras correctas. Baja {params.step_down_db} dB tras pasar, sube {params.step_up_db} dB tras fallar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {state.levelStats.length === 0 ? (
              <p className="text-sm text-[var(--muted-foreground)]">Sin datos aún.</p>
            ) : (
              <div className="space-y-1.5">
                {state.levelStats.map(s => {
                  const pct = s.presented > 0 ? s.passed / s.presented : 0
                  return (
                    <div key={s.snr_db} className={cn(
                      'flex items-center gap-3 p-2 rounded-md border',
                      s.completed && s.pass && 'border-emerald-500/40 bg-emerald-500/5',
                      s.completed && !s.pass && 'border-red-500/40 bg-red-500/5',
                      !s.completed && 'border-[var(--border)]/50',
                    )}>
                      <span className="font-mono font-bold w-20">{s.snr_db} dB</span>
                      <span className="text-sm">{s.passed}/{s.presented}</span>
                      <span className="flex-1 text-xs text-[var(--muted-foreground)]">{Math.round(pct * 100)}%</span>
                      {s.completed && (
                        <Badge className={s.pass ? 'bg-emerald-500' : 'bg-red-500'}>
                          {s.pass ? 'Pasa' : 'Falla'}
                        </Badge>
                      )}
                      {state.currentSnr === s.snr_db && !state.finished && <Badge>actual</Badge>}
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {state.finished && (
          <Card className="border-2 border-[var(--primary)]">
            <CardHeader>
              <CardTitle>Resultado</CardTitle>
              <CardDescription>
                {state.ended_reason === 'bracketed' && 'SRT-SNR por bracketing (pasa + falla por debajo).'}
                {state.ended_reason === 'floor' && 'SNR mínimo alcanzado.'}
                {state.ended_reason === 'ceiling' && 'SNR máximo alcanzado sin respuestas.'}
                {state.ended_reason === 'max_trials' && 'Tope de presentaciones alcanzado.'}
                {state.ended_reason === 'manual' && 'Terminado manualmente.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center p-6 bg-gradient-to-br from-[var(--primary)]/20 to-[var(--accent)]/20 rounded-lg mb-4">
                <div className="text-xs text-[var(--muted-foreground)] uppercase tracking-wider">SRT-SNR</div>
                <div className="text-5xl font-black text-[var(--primary)] mt-1">
                  {state.srtSnrDb !== null ? `${state.srtSnrDb} dB` : 'No determinado'}
                </div>
              </div>
              <Label>Observaciones</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4} placeholder="Observaciones clínicas, comportamiento, etc." />
              <Button size="lg" className="w-full mt-4" onClick={handleSave} disabled={finishing}>
                {preview ? 'Cerrar vista previa' : finishing ? 'Guardando...' : 'Finalizar y generar informe'}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

function StatTile({ label, value, accent, big }: { label: string; value: string; accent?: boolean; big?: boolean }) {
  return (
    <div className={cn(
      'rounded-xl p-3 text-center border',
      accent ? 'bg-gradient-to-br from-[var(--primary)]/10 to-[var(--accent)]/10 border-[var(--primary)]/30' : 'bg-[var(--card)] border-[var(--border)]',
    )}>
      <div className="text-[10px] uppercase tracking-wider text-[var(--muted-foreground)] font-semibold">{label}</div>
      <div className={cn('font-black mt-1', big ? 'text-2xl text-[var(--primary)]' : 'text-lg')}>{value}</div>
    </div>
  )
}
