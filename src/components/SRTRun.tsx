import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Play, Check, X, StopCircle, Keyboard, AlertTriangle, Flag, GraduationCap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { finishSession, cancelSession, saveResponse, listResponses } from '@/lib/db/sessions'
import { getStimulusListByCode, listStimuli } from '@/lib/db/stimuli'
import { SRTController, type SRTState } from '@/lib/audio/srtRunner'
import { ensureRunning, playStimulusBuffer, loadStimulusBuffer, type CalibCurvePoint, resolveRefDb } from '@/lib/audio/engine'
import { loadStimulusWav } from '@/lib/fs/stimuli'
import { useKeyboard, Kbd } from '@/hooks/useKeyboard'
import { PatientInstructionsModal } from '@/components/PatientInstructionsModal'
import { PreviewBanner } from '@/components/PreviewBanner'
import type { TestSession, TestTemplateParsed, Patient, SRTParams, Stimulus } from '@/types'
import { cn } from '@/lib/utils'

interface Props {
  session: TestSession
  template: TestTemplateParsed
  patient: Patient
  params: SRTParams
  preview?: boolean
}

export function SRTRun({ session, template, patient, params, preview = false }: Props) {
  const navigate = useNavigate()
  const sid = session.id

  const [loadError, setLoadError] = useState<string | null>(null)
  const ctrlRef = useRef<SRTController | null>(null)
  const stimRef = useRef<Stimulus[]>([])
  const [state, setState] = useState<SRTState | null>(null)
  const [notes, setNotes] = useState('')
  const [finishing, setFinishing] = useState(false)
  const [flash, setFlash] = useState<'correct' | 'incorrect' | null>(null)
  const [showHelp, setShowHelp] = useState(false)
  const [showInstructions, setShowInstructions] = useState(false)
  const [phase, setPhase] = useState<'familiarization' | 'test'>('test')
  const [famIndex, setFamIndex] = useState(0)
  const [famPlaying, setFamPlaying] = useState(false)
  const timeoutRef = useRef<number | null>(null)

  const cfg = template.config
  const fb = cfg.feedback ?? { practice: 'correct_incorrect' as const, test: 'off' as const }
  const timeoutMs = cfg.response_timeout_ms ?? 0
  const familiarization = params.familiarization

  useEffect(() => {
    (async () => {
      const list = await getStimulusListByCode(params.stimulus_list_code)
      if (!list) { setLoadError(`Lista no encontrada: ${params.stimulus_list_code}`); return }
      const items = await listStimuli(list.id)
      const usable = preview ? items : items.filter(s => s.file_path)
      if (!preview && usable.length < params.words_per_level) {
        setLoadError(`Lista "${list.name}" tiene solo ${usable.length} estímulos grabados. Se requieren al menos ${params.words_per_level}.`)
        return
      }
      if (preview && usable.length === 0) {
        setLoadError(`Lista "${list.name}" está vacía.`)
        return
      }
      let curve: CalibCurvePoint[] | undefined
      if (session.calibration_curve_snapshot) {
        try { curve = JSON.parse(session.calibration_curve_snapshot) } catch { curve = undefined }
      }
      const ctrl = new SRTController(params, usable, session.ear, session.ref_db_snapshot ?? undefined, curve, preview)
      ctrlRef.current = ctrl
      stimRef.current = usable
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
      // Fase inicial: si no hay responses y hay consigna, mostrar modal; si hay familiarización, arrancar ahí
      if (prev.length === 0) {
        if (cfg.patient_instructions_md) setShowInstructions(true)
        if (familiarization?.enabled) setPhase('familiarization')
      }
      const unsub = ctrl.subscribe(setState)
      return () => { unsub() }
    })()
  }, [sid])

  // Cleanup timeout on unmount
  useEffect(() => () => {
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null }
  }, [])

  const pending = useMemo(() => {
    if (!state) return null
    return state.trials.find(t => t.correct === undefined && t.level_db === state.currentLevel) ?? null
  }, [state])
  const currentLvlStat = useMemo(() => {
    if (!state) return null
    return state.levelStats.find(s => s.level_db === state.currentLevel) ?? { level_db: state.currentLevel, presented: 0, correct: 0, completed: false }
  }, [state])

  const handleEnsureTrial = () => {
    const ctrl = ctrlRef.current
    if (!ctrl || ctrl.state.finished) return null
    return ctrl.pendingTrial() ?? ctrl.prepareNext()
  }

  const clearResponseTimeout = () => {
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null }
  }

  const handlePlay = async () => {
    if (phase === 'familiarization') { playFamiliarization(); return }
    const ctrl = ctrlRef.current
    if (!ctrl || ctrl.state.finished || ctrl.state.isPlaying) return
    await ensureRunning()
    const trial = handleEnsureTrial()
    if (!trial) return
    await ctrl.play(trial)
    // Arm response timeout si corresponde
    if (timeoutMs > 0) {
      clearResponseTimeout()
      timeoutRef.current = window.setTimeout(() => {
        if (ctrlRef.current?.pendingTrial()) handleAnswer(false)
      }, timeoutMs)
    }
  }

  const handleAnswer = async (correct: boolean) => {
    const ctrl = ctrlRef.current
    if (!ctrl || ctrl.state.isPlaying) return
    const trial = ctrl.pendingTrial()
    if (!trial) return
    clearResponseTimeout()
    ctrl.answer(correct)
    if (fb.test === 'correct_incorrect') {
      setFlash(correct ? 'correct' : 'incorrect')
      setTimeout(() => setFlash(null), 350)
    }
    if (!preview) {
      await saveResponse({
        session_id: sid,
        item_index: trial.index,
        phase: 'test',
        expected_pattern: `L${trial.level_db}|${trial.token}`,
        given_pattern: correct ? trial.token : '',
        is_correct: correct,
        reaction_time_ms: trial.presented_at ? Date.now() - trial.presented_at : null,
      })
    }
  }

  const playFamiliarization = async () => {
    if (!familiarization || famPlaying) return
    const stims = stimRef.current
    if (stims.length === 0) return
    setFamPlaying(true)
    await ensureRunning()
    const stim = stims[famIndex % stims.length]
    if (!stim.file_path) { setFamPlaying(false); return }
    try {
      const bytes = await loadStimulusWav(stim.file_path)
      const buf = await loadStimulusBuffer(stim.file_path, bytes)
      const ref = session.ref_db_snapshot ?? resolveRefDb(1000, session.ear)
      await new Promise<void>((resolve) => {
        playStimulusBuffer(buf, familiarization.level_db, {
          ear: session.ear, rms_dbfs: stim.rms_dbfs, refDb: ref,
          onEnd: () => resolve(),
        })
      })
    } finally {
      setFamPlaying(false)
    }
  }

  const famTotal = familiarization?.count ?? 3
  const handleFamNext = () => {
    if (famIndex + 1 >= famTotal) { setPhase('test'); return }
    setFamIndex(i => i + 1)
  }
  const handleSkipFamiliarization = () => setPhase('test')

  const handleCancel = async () => {
    if (preview) { navigate(`/tests?id=${template.id}`); return }
    if (!confirm('¿Cancelar evaluación?')) return
    await cancelSession(sid)
    navigate('/evaluacion')
  }

  const handleFinishManual = () => {
    if (!ctrlRef.current) return
    if (!confirm('¿Terminar ahora? El SRT se calcula con los datos actuales.')) return
    ctrlRef.current.finishManual()
  }

  const handleSave = async () => {
    const ctrl = ctrlRef.current
    if (!ctrl) return
    if (preview) { navigate(`/tests?id=${template.id}`); return }
    setFinishing(true)
    try {
      const totalScored = ctrl.state.trials.filter(t => t.correct !== undefined).length
      const totalCorrect = ctrl.state.trials.filter(t => t.correct).length
      const srt = ctrl.state.srtDb
      const srtNotePrefix = srt !== null ? `SRT estimado: ${srt} dB HL. ` : `SRT no determinado (${ctrl.state.ended_reason ?? 'sin datos'}). `
      await finishSession(sid, {
        practice_score: 0,
        test_score: totalScored > 0 ? totalCorrect / totalScored : 0,
        total_items: totalScored,
        correct_items: totalCorrect,
        notes: srtNotePrefix + (notes || ''),
      })
      navigate(`/informes/${sid}`)
    } finally {
      setFinishing(false)
    }
  }

  useKeyboard([
    { keys: [' '], handler: handlePlay },
    { keys: ['k', 'ArrowRight', '1'], handler: () => handleAnswer(true) },
    { keys: ['j', 'ArrowLeft', '2'], handler: () => handleAnswer(false) },
    { keys: ['?', 'h'], handler: () => setShowHelp(v => !v) },
    { keys: ['Escape'], handler: () => setShowHelp(false) },
  ], [state])

  if (loadError) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
              <AlertTriangle className="w-5 h-5" /> No se puede iniciar SRT
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>{loadError}</p>
            <p className="text-[var(--muted-foreground)]">
              Graba los estímulos de la lista antes de correr la prueba.
            </p>
            <div className="flex gap-2">
              <Button onClick={() => navigate('/estimulos')}>Ir a Estudio</Button>
              <Button variant="outline" onClick={handleCancel}>Cancelar sesión</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!state) return <div className="p-8">Cargando SRT...</div>

  const presentedAtLvl = currentLvlStat?.presented ?? 0
  const correctAtLvl = currentLvlStat?.correct ?? 0
  const ratio = presentedAtLvl > 0 ? (correctAtLvl / presentedAtLvl) : null

  return (
    <div className={cn(
      'min-h-screen transition-colors duration-300',
      flash === 'correct' && 'bg-emerald-50 dark:bg-emerald-950/20',
      flash === 'incorrect' && 'bg-red-50 dark:bg-red-950/20'
    )}>
      <div className="p-8 max-w-5xl mx-auto">
        {preview && <PreviewBanner />}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-3xl font-black tracking-tight">{template.name}</h1>
            <p className="text-[var(--muted-foreground)]">
              {patient.last_name}, {patient.first_name} · Oído: <span className="font-medium capitalize">{session.ear}</span> · SRT
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowHelp(v => !v)}>
              <Keyboard className="w-4 h-4" /> Atajos <Kbd>?</Kbd>
            </Button>
            <Button variant="outline" size="sm" onClick={handleCancel}>
              <StopCircle className="w-4 h-4" /> Cancelar
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3 mb-6">
          <StatTile label="Nivel actual" value={`${state.currentLevel} dB`} accent />
          <StatTile label="En nivel" value={`${presentedAtLvl}/${params.words_per_level}`} />
          <StatTile label="Aciertos nivel" value={ratio !== null ? `${Math.round(ratio * 100)}%` : '—'} />
          <StatTile label="SRT estimado" value={state.srtDb !== null ? `${state.srtDb} dB` : '—'} big />
        </div>

        {phase === 'familiarization' && familiarization && (
          <Card className="mb-6 border-2 border-amber-500/30 bg-amber-500/5">
            <div className="h-1 bg-amber-500" />
            <CardContent className="p-8">
              <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-amber-700 dark:text-amber-400 mb-3 justify-center">
                <GraduationCap className="w-4 h-4" /> Familiarización ({famIndex + 1}/{famTotal})
              </div>
              <p className="text-center text-sm text-[var(--muted-foreground)] mb-4">
                Demo sin scoring a {familiarization.level_db} dB HL. {familiarization.show_list ? 'Palabra visible al paciente.' : 'Palabra oculta.'}
              </p>
              {familiarization.show_list && stimRef.current[famIndex] && (
                <div className="text-center text-3xl font-mono font-bold mb-4">{stimRef.current[famIndex].token}</div>
              )}
              <div className="flex gap-3 justify-center">
                <Button size="lg" onClick={playFamiliarization} disabled={famPlaying}>
                  <Play className="w-4 h-4" /> {famPlaying ? 'Reproduciendo...' : 'Reproducir'}
                </Button>
                <Button size="lg" variant="outline" onClick={handleFamNext} disabled={famPlaying}>
                  Siguiente
                </Button>
                <Button size="lg" variant="ghost" onClick={handleSkipFamiliarization}>
                  Omitir familiarización → Test
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {phase === 'test' && !state.finished && (
          <Card className="mb-6 border-2 border-[var(--primary)]/20">
            <div className="h-1 bg-[var(--primary)]" />
            <CardContent className="p-8">
              <div className="text-center mb-6">
                <div className="text-xs uppercase tracking-widest text-[var(--muted-foreground)] mb-2">
                  {pending ? 'Palabra presentada' : 'Próxima palabra'}
                </div>
                <div className="text-5xl font-bold font-mono tracking-wide min-h-[60px]">
                  {pending ? pending.token : <span className="text-[var(--muted-foreground)] text-2xl">— pulsa reproducir —</span>}
                </div>
              </div>

              <div className="flex gap-3 justify-center mb-6">
                <Button size="xl" onClick={handlePlay} disabled={state.isPlaying || !!pending} className="min-w-[200px]">
                  <Play className="w-5 h-5" /> {state.isPlaying ? 'Reproduciendo...' : pending ? 'Palabra lista — marcá respuesta' : 'Siguiente palabra'}
                  <Kbd className="ml-2 bg-white/20 border-white/30 text-white">Espacio</Kbd>
                </Button>
              </div>

              <div className="flex gap-3 justify-center flex-wrap">
                <Button size="lg" variant="destructive" onClick={() => handleAnswer(false)} disabled={!pending || state.isPlaying} className="min-w-[160px]">
                  <X className="w-5 h-5" /> Incorrecto <Kbd className="ml-1 bg-white/20 border-white/30 text-white">J</Kbd>
                </Button>
                <Button size="lg" className="bg-emerald-600 hover:bg-emerald-700 text-white min-w-[160px]" onClick={() => handleAnswer(true)} disabled={!pending || state.isPlaying}>
                  <Check className="w-5 h-5" /> Correcto <Kbd className="ml-1 bg-white/20 border-white/30 text-white">K</Kbd>
                </Button>
              </div>

              <div className="text-center mt-6">
                <Button variant="ghost" size="sm" onClick={handleFinishManual}>
                  <Flag className="w-4 h-4" /> Terminar y calcular SRT
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Progreso por nivel</CardTitle>
            <CardDescription>
              Regla: {Math.round(params.threshold_pass_ratio * 100)}% para aprobar. Desciende {params.step_down_db} dB tras pasar, sube {params.step_up_db} dB tras fallar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {state.levelStats.length === 0 ? (
              <p className="text-sm text-[var(--muted-foreground)]">Aún sin datos. Presentá la primera palabra.</p>
            ) : (
              <div className="space-y-1.5">
                {state.levelStats.map(s => {
                  const pct = s.presented > 0 ? s.correct / s.presented : 0
                  return (
                    <div key={s.level_db} className={cn(
                      'flex items-center gap-3 p-2 rounded-md border',
                      s.completed && s.pass && 'border-emerald-500/40 bg-emerald-500/5',
                      s.completed && !s.pass && 'border-red-500/40 bg-red-500/5',
                      !s.completed && 'border-[var(--border)]/50'
                    )}>
                      <span className="font-mono font-bold w-20">{s.level_db} dB</span>
                      <span className="text-sm">{s.correct}/{s.presented}</span>
                      <span className="flex-1 text-xs text-[var(--muted-foreground)]">{Math.round(pct * 100)}%</span>
                      {s.completed && (
                        <Badge className={s.pass ? 'bg-emerald-500' : 'bg-red-500'}>
                          {s.pass ? 'Pasa' : 'Falla'}
                        </Badge>
                      )}
                      {state.currentLevel === s.level_db && !state.finished && <Badge>actual</Badge>}
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
                {state.ended_reason === 'bracketed' && 'SRT por bracketing (pasa + falla por debajo).'}
                {state.ended_reason === 'floor' && 'Se alcanzó el nivel mínimo configurado.'}
                {state.ended_reason === 'ceiling' && 'Se alcanzó el nivel máximo configurado sin respuestas.'}
                {state.ended_reason === 'max_trials' && 'Se alcanzó el tope de presentaciones.'}
                {state.ended_reason === 'manual' && 'Terminado manualmente.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center p-6 bg-gradient-to-br from-[var(--primary)]/20 to-[var(--accent)]/20 rounded-lg mb-4">
                <div className="text-xs text-[var(--muted-foreground)] uppercase tracking-wider">SRT estimado</div>
                <div className="text-5xl font-black text-[var(--primary)] mt-1">
                  {state.srtDb !== null ? `${state.srtDb} dB HL` : 'No determinado'}
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

        {showHelp && <ShortcutsOverlay onClose={() => setShowHelp(false)} />}
        {showInstructions && cfg.patient_instructions_md && (
          <PatientInstructionsModal
            instructions_md={cfg.patient_instructions_md}
            onStart={() => setShowInstructions(false)}
            onClose={() => setShowInstructions(false)}
          />
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

function ShortcutsOverlay({ onClose }: { onClose: () => void }) {
  const entries: [string[], string][] = [
    [['Espacio'], 'Reproducir próxima palabra'],
    [['K', '→', '1'], 'Marcar correcto'],
    [['J', '←', '2'], 'Marcar incorrecto'],
    [['?', 'H'], 'Mostrar/ocultar esta ayuda'],
    [['Esc'], 'Cerrar ayuda'],
  ]
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-[var(--card)] rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-4">
          <Keyboard className="w-5 h-5 text-[var(--primary)]" />
          <h3 className="text-xl font-bold">Atajos de teclado</h3>
        </div>
        <div className="space-y-2">
          {entries.map(([keys, desc], i) => (
            <div key={i} className="flex items-center justify-between p-2 rounded-md hover:bg-[var(--secondary)]">
              <span className="text-sm">{desc}</span>
              <div className="flex gap-1">
                {keys.map(k => <Kbd key={k}>{k}</Kbd>)}
              </div>
            </div>
          ))}
        </div>
        <Button className="w-full mt-4" onClick={onClose}>Cerrar</Button>
      </div>
    </div>
  )
}
