import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Play, StopCircle, AlertTriangle, Flag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { finishSession, cancelSession, saveResponse, listResponses } from '@/lib/db/sessions'
import { getStimulusListByCode, listStimuli, parseKeywords } from '@/lib/db/stimuli'
import { HINTController, type HINTState } from '@/lib/audio/hintRunner'
import { ensureRunning, type CalibCurvePoint } from '@/lib/audio/engine'
import { PreviewBanner } from '@/components/PreviewBanner'
import type { TestSession, TestTemplateParsed, Patient, HINTParams } from '@/types'
import { cn } from '@/lib/utils'

interface Props {
  session: TestSession
  template: TestTemplateParsed
  patient: Patient
  params: HINTParams
  preview?: boolean
}

function normalizeWord(w: string): string {
  return w.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^\p{L}\p{N}]+/gu, '')
}

export function HINTRun({ session, template, patient, params, preview = false }: Props) {
  const navigate = useNavigate()
  const sid = session.id

  const [loadError, setLoadError] = useState<string | null>(null)
  const ctrlRef = useRef<HINTController | null>(null)
  const [state, setState] = useState<HINTState | null>(null)
  const [notes, setNotes] = useState('')
  const [finishing, setFinishing] = useState(false)
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())

  useEffect(() => {
    (async () => {
      const list = await getStimulusListByCode(params.stimulus_list_code)
      if (!list) { setLoadError(`Lista no encontrada: ${params.stimulus_list_code}`); return }
      const items = await listStimuli(list.id)
      const usable = preview
        ? items
        : items.filter(s => s.file_path && parseKeywords(s).length > 0)
      if (!preview && usable.length < params.sentences_per_level) {
        setLoadError(`Lista "${list.name}" tiene ${usable.length} frases grabadas con palabras clave. Se requieren al menos ${params.sentences_per_level}. Revisa /estimulos.`)
        return
      }
      if (preview && usable.length === 0) {
        setLoadError(`Lista "${list.name}" está vacía.`)
        return
      }
      let curve: CalibCurvePoint[] | undefined
      if (session.calibration_curve_snapshot) {
        try { curve = JSON.parse(session.calibration_curve_snapshot) } catch { /* noop */ }
      }
      const ctrl = new HINTController(params, usable, session.ear, session.ref_db_snapshot ?? undefined, curve, preview)
      ctrlRef.current = ctrl
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
    setSelectedKeys(new Set())
    await c.play(trial)
  }

  const handleSubmit = async () => {
    const c = ctrlRef.current
    if (!c || c.state.isPlaying) return
    const t = c.pendingTrial()
    if (!t) return
    const keys = Array.from(selectedKeys)
    c.answer(keys)
    if (!preview) {
      await saveResponse({
        session_id: sid,
        item_index: t.index,
        phase: 'test',
        expected_pattern: `S${t.snr_db}|${t.token}`,
        given_pattern: keys.join('|'),
        is_correct: (keys.length / Math.max(1, t.keywords.length)) >= params.threshold_pass_ratio,
        reaction_time_ms: t.presented_at ? Date.now() - t.presented_at : null,
      })
    }
    setSelectedKeys(new Set())
  }

  const toggleKey = (k: string) => {
    setSelectedKeys(prev => {
      const next = new Set(prev)
      if (next.has(k)) next.delete(k); else next.add(k)
      return next
    })
  }

  const markAll = () => pending && setSelectedKeys(new Set(pending.keywords))
  const markNone = () => setSelectedKeys(new Set())

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
      const totalScored = c.state.trials.filter(t => t.pass !== undefined).length
      const totalPassed = c.state.trials.filter(t => t.pass).length
      const srt = c.state.srtSnrDb
      const notePrefix = srt !== null ? `SRT-SNR estimado: ${srt} dB. ` : `SRT-SNR no determinado (${c.state.ended_reason ?? 'sin datos'}). `
      await finishSession(sid, {
        practice_score: 0,
        test_score: totalScored > 0 ? totalPassed / totalScored : 0,
        total_items: totalScored,
        correct_items: totalPassed,
        notes: notePrefix + (notes || ''),
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
              <AlertTriangle className="w-5 h-5" /> No se puede iniciar HINT
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

  if (!state) return <div className="p-8">Cargando HINT...</div>

  const voiceLevel = params.noise_level_db + state.currentSnr

  return (
    <div className="min-h-screen">
      <div className="p-8 max-w-5xl mx-auto">
        {preview && <PreviewBanner />}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-3xl font-black tracking-tight">{template.name}</h1>
            <p className="text-[var(--muted-foreground)]">
              {patient.last_name}, {patient.first_name} · Oído: <span className="font-medium capitalize">{session.ear}</span> · HINT (SNR adaptativo)
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
            <CardContent className="p-8">
              <div className="text-center mb-6">
                <div className="text-xs uppercase tracking-widest text-[var(--muted-foreground)] mb-2">
                  {pending ? 'Frase presentada — marca palabras clave entendidas' : 'Próxima frase'}
                </div>
                {pending ? (
                  <div className="flex flex-wrap gap-2 justify-center max-w-3xl mx-auto">
                    {pending.token.split(/\s+/).map((w, i) => {
                      const n = normalizeWord(w)
                      const isKey = pending.keywords.includes(n)
                      const isSelected = selectedKeys.has(n)
                      return (
                        <button
                          key={i}
                          onClick={() => isKey && toggleKey(n)}
                          disabled={!isKey}
                          className={cn(
                            'text-2xl px-3 py-1.5 rounded-md border-2 transition-all',
                            !isKey && 'border-transparent text-[var(--muted-foreground)] cursor-default',
                            isKey && !isSelected && 'border-[var(--border)] hover:border-[var(--primary)]/50',
                            isKey && isSelected && 'border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold'
                          )}
                        >{w}</button>
                      )
                    })}
                  </div>
                ) : (
                  <div className="text-[var(--muted-foreground)] text-xl py-4">— pulsá reproducir —</div>
                )}
                {pending && (
                  <div className="flex gap-2 justify-center mt-3 text-xs">
                    <button className="underline text-[var(--muted-foreground)]" onClick={markAll}>todas ok</button>
                    <span className="text-[var(--muted-foreground)]">·</span>
                    <button className="underline text-[var(--muted-foreground)]" onClick={markNone}>ninguna</button>
                    <span className="text-[var(--muted-foreground)]">· {selectedKeys.size}/{pending.keywords.length} clave</span>
                  </div>
                )}
              </div>

              <div className="flex gap-3 justify-center flex-wrap">
                <Button size="xl" onClick={handlePlay} disabled={state.isPlaying || !!pending} className="min-w-[200px]">
                  <Play className="w-5 h-5" /> {state.isPlaying ? 'Reproduciendo...' : pending ? 'En espera de respuesta' : 'Reproducir frase'}
                </Button>
                <Button size="xl" onClick={handleSubmit} disabled={!pending || state.isPlaying} className="bg-emerald-600 hover:bg-emerald-700 text-white min-w-[180px]">
                  Confirmar respuesta
                </Button>
              </div>

              <div className="text-center mt-6">
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
              Pasa si ≥{Math.round(params.threshold_pass_ratio * 100)}% palabras clave correctas. Baja SNR {params.step_down_db} dB tras pasar, sube {params.step_up_db} dB tras fallar.
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
                      !s.completed && 'border-[var(--border)]/50'
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
                {state.ended_reason === 'floor' && 'Se alcanzó el SNR mínimo configurado.'}
                {state.ended_reason === 'ceiling' && 'Se alcanzó el SNR máximo sin respuestas.'}
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
      accent ? 'bg-gradient-to-br from-[var(--primary)]/10 to-[var(--accent)]/10 border-[var(--primary)]/30' : 'bg-[var(--card)] border-[var(--border)]'
    )}>
      <div className="text-[10px] uppercase tracking-wider text-[var(--muted-foreground)] font-semibold">{label}</div>
      <div className={cn('font-black mt-1', big ? 'text-2xl text-[var(--primary)]' : 'text-lg')}>{value}</div>
    </div>
  )
}
