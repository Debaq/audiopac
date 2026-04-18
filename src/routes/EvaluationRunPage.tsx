import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Play, SkipForward, Check, X, RotateCcw, StopCircle, Keyboard } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { getSession, finishSession, cancelSession, saveResponse, listResponses } from '@/lib/db/sessions'
import { getTemplate } from '@/lib/db/templates'
import { getPatient } from '@/lib/db/patients'
import { TestRunner, type RunnerState } from '@/lib/audio/runner'
import { ensureRunning, type CalibCurvePoint } from '@/lib/audio/engine'
import { useKeyboard, Kbd } from '@/hooks/useKeyboard'
import { SRTRun } from '@/components/SRTRun'
import { DichoticDigitsRun } from '@/components/DichoticDigitsRun'
import type { TestSession, TestTemplateParsed, Patient } from '@/types'
import { percent, cn } from '@/lib/utils'

const TONE_COLORS = ['#6B1F2E', '#A63446', '#D17682', '#2B7A78', '#DDB967', '#5B8E7D']

export function EvaluationRunPage() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const sid = Number(sessionId)

  const [session, setSession] = useState<TestSession | null>(null)
  const [template, setTemplate] = useState<TestTemplateParsed | null>(null)
  const [patient, setPatient] = useState<Patient | null>(null)
  const runnerRef = useRef<TestRunner | null>(null)
  const [state, setState] = useState<RunnerState | null>(null)
  const [notes, setNotes] = useState('')
  const [manualResponse, setManualResponse] = useState('')
  const [finishing, setFinishing] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [playingToneIdx, setPlayingToneIdx] = useState<number | null>(null)
  const [flash, setFlash] = useState<'correct' | 'incorrect' | null>(null)

  useEffect(() => {
    (async () => {
      const s = await getSession(sid)
      if (!s) return
      setSession(s)
      const [t, p] = await Promise.all([getTemplate(s.template_id), getPatient(s.patient_id)])
      setTemplate(t)
      setPatient(p)
      if (t?.config.srt) return
      if (t?.config.dichotic_digits) return
      if (t) {
        let curve: CalibCurvePoint[] | undefined
        if (s.calibration_curve_snapshot) {
          try { curve = JSON.parse(s.calibration_curve_snapshot) } catch { curve = undefined }
        }
        const r = new TestRunner(t.config, s.ear, 'practice', s.ref_db_snapshot ?? undefined, curve)
        runnerRef.current = r
        const prev = await listResponses(sid)
        if (prev.length > 0) r.hydrate(prev)
        setState({ ...r.state })
        const unsub = r.subscribe(setState)
        return () => { unsub() }
      }
    })()
  }, [sid])

  const current = useMemo(() => {
    if (!state || !runnerRef.current) return null
    return runnerRef.current.currentItem
  }, [state])

  const scores = useMemo(() => runnerRef.current?.getScores(), [state])
  const tones = template ? Object.keys(template.config.tones) : []

  const animateTones = (pattern: string) => {
    if (!template) return
    const cfg = template.config
    let offset = 0
    pattern.split('').forEach((ch, idx) => {
      const tone = cfg.tones[ch]
      const dur = tone?.duration_ms ?? cfg.duration_ms ?? 200
      setTimeout(() => setPlayingToneIdx(idx), offset + 50)
      offset += dur + cfg.isi_ms
    })
    setTimeout(() => setPlayingToneIdx(null), offset + 100)
  }

  const handlePlay = async () => {
    await ensureRunning()
    if (current) animateTones(current.pattern)
    await runnerRef.current?.play()
  }

  const handleMark = async (correct: boolean) => {
    const runner = runnerRef.current
    const item = current
    if (!runner || !item || state?.isPlaying) return
    const given = manualResponse.trim().toUpperCase() || (correct ? item.pattern : '???')
    runner.answer(given)
    item.correct = correct
    setFlash(correct ? 'correct' : 'incorrect')
    setTimeout(() => setFlash(null), 400)
    await saveResponse({
      session_id: sid,
      item_index: item.index,
      phase: item.phase,
      expected_pattern: item.pattern,
      given_pattern: given,
      is_correct: correct,
      reaction_time_ms: item.presentedAt ? Date.now() - item.presentedAt : null,
    })
    setManualResponse('')
    runner.next()
  }

  const handleSkip = () => {
    runnerRef.current?.next()
    setManualResponse('')
  }

  const handleSkipToTest = () => {
    runnerRef.current?.skipPracticeToTest()
  }

  const handleCancel = async () => {
    if (!confirm('¿Cancelar evaluación?')) return
    await cancelSession(sid)
    navigate('/evaluacion')
  }

  const handleFinish = async () => {
    const runner = runnerRef.current
    if (!runner) return
    setFinishing(true)
    try {
      const s = runner.getScores()
      await finishSession(sid, {
        practice_score: s.practice.score,
        test_score: s.test.score,
        total_items: s.test.total,
        correct_items: s.test.correct,
        notes,
      })
      navigate(`/informes/${sid}`)
    } finally {
      setFinishing(false)
    }
  }

  useKeyboard([
    { keys: [' '], handler: handlePlay },
    { keys: ['k', 'ArrowRight', '1'], handler: () => handleMark(true) },
    { keys: ['j', 'ArrowLeft', '2'], handler: () => handleMark(false) },
    { keys: ['s', 'Tab'], handler: handleSkip },
    { keys: ['r'], handler: handlePlay },
    { keys: ['?', 'h'], handler: () => setShowHelp(v => !v) },
    { keys: ['Escape'], handler: () => setShowHelp(false) },
  ], [current, state, template])

  if (!session || !template || !patient) {
    return <div className="p-8">Cargando evaluación...</div>
  }

  if (template.config.srt) {
    return <SRTRun session={session} template={template} patient={patient} params={template.config.srt} />
  }

  if (template.config.dichotic_digits) {
    return <DichoticDigitsRun session={session} template={template} patient={patient} params={template.config.dichotic_digits} />
  }

  if (!state) {
    return <div className="p-8">Cargando evaluación...</div>
  }

  const isTestPhase = state.phase === 'test'
  const allTestAnswered = state.items.filter(i => i.phase === 'test').every(i => i.correct !== undefined)
  const progress = ((state.currentIndex + 1) / state.items.length) * 100

  const toneColor = (key: string): string => {
    const idx = tones.indexOf(key)
    return TONE_COLORS[idx % TONE_COLORS.length]
  }

  return (
    <div className={cn(
      'min-h-screen transition-colors duration-300',
      flash === 'correct' && 'bg-emerald-50 dark:bg-emerald-950/20',
      flash === 'incorrect' && 'bg-red-50 dark:bg-red-950/20'
    )}>
      <div className="p-8 max-w-5xl mx-auto">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-3xl font-black tracking-tight">{template.name}</h1>
            <p className="text-[var(--muted-foreground)]">
              {patient.last_name}, {patient.first_name} · Oído: <span className="font-medium capitalize">{session.ear}</span>
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

        {/* Progress bar with phase tint */}
        <div className="relative h-2 bg-[var(--secondary)] rounded-full overflow-hidden mb-6">
          <div
            className={cn(
              'h-full transition-all duration-500 rounded-full',
              isTestPhase ? 'bg-gradient-to-r from-[var(--primary)] to-[var(--accent)]' : 'bg-gradient-to-r from-amber-400 to-amber-500'
            )}
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="grid grid-cols-4 gap-3 mb-6">
          <StatTile label="Fase" value={isTestPhase ? 'TEST' : 'PRÁCTICA'} accent={isTestPhase} />
          <StatTile label="Ítem" value={`${state.currentIndex + 1}/${state.items.length}`} />
          <StatTile label="Aciertos test" value={scores ? `${percent(scores.test.score, 1)}%` : '—'} big />
          <StatTile label="Racha" value={String(calcStreak(state))} />
        </div>

        {!state.finished && current && (
          <Card className="mb-6 overflow-hidden border-2 border-[var(--primary)]/20">
            <div className={cn('h-1', isTestPhase ? 'bg-[var(--primary)]' : 'bg-amber-400')} />
            <CardContent className="p-8">
              {/* Visual tone blocks (hidden pattern visualization) */}
              <div className="flex justify-center items-end gap-2 min-h-[120px] mb-8">
                {current.pattern.split('').map((ch, i) => {
                  const tone = template.config.tones[ch]
                  const dur = tone?.duration_ms ?? template.config.duration_ms ?? 200
                  const freq = tone?.frequency ?? template.config.frequency ?? 1000
                  const maxDur = Math.max(...Object.values(template.config.tones).map(x => x.duration_ms ?? template.config.duration_ms ?? 300), 100)
                  const freqs = Object.values(template.config.tones).map(x => x.frequency ?? template.config.frequency ?? 1000)
                  const maxF = Math.max(...freqs)
                  const minF = Math.min(...freqs)
                  const range = Math.max(1, maxF - minF)
                  const w = Math.max(40, Math.min(110, 40 + (dur / maxDur) * 70))
                  const h = 60 + ((freq - minF) / range) * 60
                  const isActive = playingToneIdx === i
                  return (
                    <div key={i} className="flex flex-col items-center gap-2">
                      <div
                        style={{
                          width: w,
                          height: h,
                          background: toneColor(ch),
                          transform: isActive ? 'scale(1.15)' : 'scale(1)',
                          boxShadow: isActive ? `0 0 30px ${toneColor(ch)}` : undefined,
                        }}
                        className={cn(
                          'rounded-lg flex items-center justify-center text-white font-bold text-3xl transition-all duration-200',
                          isActive && 'ring-4 ring-white dark:ring-black animate-pulse'
                        )}
                      >
                        {state.isPlaying ? (isActive ? ch : '·') : ch}
                      </div>
                      <span className="text-xs text-[var(--muted-foreground)] font-medium">
                        {tone?.label}
                      </span>
                    </div>
                  )
                })}
              </div>

              <div className="flex gap-3 justify-center mb-6">
                <Button size="xl" onClick={handlePlay} disabled={state.isPlaying} className="min-w-[180px]">
                  <Play className="w-5 h-5" /> {state.isPlaying ? 'Reproduciendo...' : 'Reproducir'}
                  <Kbd className="ml-2 bg-white/20 border-white/30 text-white">Espacio</Kbd>
                </Button>
                <Button size="xl" variant="outline" onClick={handlePlay} disabled={state.isPlaying}>
                  <RotateCcw className="w-5 h-5" /> Repetir <Kbd className="ml-2">R</Kbd>
                </Button>
              </div>

              <div className="max-w-md mx-auto mb-5">
                <Label>Respuesta del paciente (opcional)</Label>
                <input
                  type="text"
                  value={manualResponse}
                  onChange={e => setManualResponse(e.target.value.toUpperCase())}
                  placeholder={`Ej: ${current.pattern}`}
                  className="w-full h-14 text-center text-3xl font-mono uppercase tracking-[0.4em] rounded-md border-2 border-[var(--input)] bg-[var(--background)] mt-2 focus:border-[var(--primary)] outline-none"
                  maxLength={current.pattern.length}
                />
              </div>

              <div className="flex gap-3 justify-center flex-wrap">
                <Button size="lg" variant="destructive" onClick={() => handleMark(false)} className="min-w-[160px]">
                  <X className="w-5 h-5" /> Incorrecto <Kbd className="ml-1 bg-white/20 border-white/30 text-white">J</Kbd>
                </Button>
                <Button size="lg" variant="outline" onClick={handleSkip} className="min-w-[120px]">
                  <SkipForward className="w-5 h-5" /> Saltar <Kbd className="ml-1">S</Kbd>
                </Button>
                <Button size="lg" className="bg-emerald-600 hover:bg-emerald-700 text-white min-w-[160px]" onClick={() => handleMark(true)}>
                  <Check className="w-5 h-5" /> Correcto <Kbd className="ml-1 bg-white/20 border-white/30 text-white">K</Kbd>
                </Button>
              </div>

              {!isTestPhase && (
                <div className="text-center mt-4">
                  <Button variant="ghost" size="sm" onClick={handleSkipToTest}>
                    Saltar a fase de test →
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {(state.finished || allTestAnswered) && (
          <Card className="border-2 border-[var(--primary)]">
            <CardHeader>
              <CardTitle>Finalizar evaluación</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="text-center p-4 bg-[var(--secondary)] rounded-lg">
                  <div className="text-xs text-[var(--muted-foreground)]">Práctica</div>
                  <div className="text-3xl font-bold">{scores ? `${percent(scores.practice.score, 1)}%` : '—'}</div>
                </div>
                <div className="text-center p-4 bg-gradient-to-br from-[var(--primary)]/20 to-[var(--accent)]/20 rounded-lg">
                  <div className="text-xs text-[var(--muted-foreground)]">Test</div>
                  <div className="text-3xl font-bold text-[var(--primary)]">{scores ? `${percent(scores.test.score, 1)}%` : '—'}</div>
                </div>
              </div>
              <Label>Observaciones</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4} placeholder="Observaciones clínicas, comportamiento, etc." />
              <Button size="lg" className="w-full mt-4" onClick={handleFinish} disabled={finishing}>
                {finishing ? 'Guardando...' : 'Finalizar y generar informe'}
              </Button>
            </CardContent>
          </Card>
        )}

        {showHelp && <ShortcutsOverlay onClose={() => setShowHelp(false)} />}
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

function calcStreak(state: RunnerState): number {
  let streak = 0
  for (let i = state.items.length - 1; i >= 0; i--) {
    const it = state.items[i]
    if (it.correct === undefined) continue
    if (it.correct) streak++
    else break
  }
  return streak
}

function ShortcutsOverlay({ onClose }: { onClose: () => void }) {
  const entries: [string[], string][] = [
    [['Espacio', 'R'], 'Reproducir / Repetir secuencia'],
    [['K', '→', '1'], 'Marcar correcto'],
    [['J', '←', '2'], 'Marcar incorrecto'],
    [['S', 'Tab'], 'Saltar ítem'],
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
