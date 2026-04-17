import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Play, SkipForward, Check, X, RotateCcw, StopCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { getSession, finishSession, cancelSession, saveResponse } from '@/lib/db/sessions'
import { getTemplate } from '@/lib/db/templates'
import { getPatient } from '@/lib/db/patients'
import { TestRunner, type RunnerState } from '@/lib/audio/runner'
import { ensureRunning } from '@/lib/audio/engine'
import type { TestSession, TestTemplateParsed, Patient } from '@/types'
import { percent } from '@/lib/utils'

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

  useEffect(() => {
    (async () => {
      const s = await getSession(sid)
      if (!s) return
      setSession(s)
      const [t, p] = await Promise.all([getTemplate(s.template_id), getPatient(s.patient_id)])
      setTemplate(t)
      setPatient(p)
      if (t) {
        const r = new TestRunner(t.config, s.ear, 'practice')
        runnerRef.current = r
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

  const handlePlay = async () => {
    await ensureRunning()
    await runnerRef.current?.play()
  }

  const handleMark = async (correct: boolean) => {
    const runner = runnerRef.current
    const item = current
    if (!runner || !item) return
    const given = manualResponse.trim().toUpperCase() || (correct ? item.pattern : '???')
    runner.answer(given)
    item.correct = correct
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

  const handleReplay = async () => {
    await ensureRunning()
    await runnerRef.current?.play()
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

  if (!session || !template || !patient || !state) {
    return <div className="p-8">Cargando evaluación...</div>
  }

  const isTestPhase = state.phase === 'test'
  const allTestAnswered = state.items.filter(i => i.phase === 'test').every(i => i.correct !== undefined)

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{template.name}</h1>
          <p className="text-[var(--muted-foreground)]">
            {patient.last_name}, {patient.first_name} • Oído: {session.ear}
          </p>
        </div>
        <Button variant="outline" onClick={handleCancel}>
          <StopCircle className="w-4 h-4" /> Cancelar
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-xs text-[var(--muted-foreground)]">Fase</div>
            <Badge variant={isTestPhase ? 'default' : 'secondary'} className="mt-2">
              {isTestPhase ? 'TEST' : 'PRÁCTICA'}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-xs text-[var(--muted-foreground)]">Ítem</div>
            <div className="text-2xl font-bold">
              {state.currentIndex + 1} / {state.items.length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-xs text-[var(--muted-foreground)]">Aciertos test</div>
            <div className="text-2xl font-bold text-[var(--primary)]">
              {scores ? `${percent(scores.test.score, 1)}%` : '—'}
            </div>
            <div className="text-xs text-[var(--muted-foreground)]">
              {scores?.test.correct} / {scores?.test.total}
            </div>
          </CardContent>
        </Card>
      </div>

      {!state.finished && current && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Secuencia actual</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-6">
              <div className="text-6xl font-mono font-bold tracking-widest text-[var(--primary)] mb-6">
                {current.pattern.split('').map((c, i) => (
                  <span key={i} className="inline-block mx-2">{c}</span>
                ))}
              </div>
              <div className="flex gap-3 justify-center mb-6">
                <Button size="xl" onClick={handlePlay} disabled={state.isPlaying}>
                  <Play className="w-5 h-5" /> {state.isPlaying ? 'Reproduciendo...' : 'Reproducir'}
                </Button>
                <Button size="xl" variant="outline" onClick={handleReplay} disabled={state.isPlaying}>
                  <RotateCcw className="w-5 h-5" /> Repetir
                </Button>
              </div>

              <div className="max-w-md mx-auto mb-4">
                <Label>Respuesta del paciente (opcional)</Label>
                <input
                  type="text"
                  value={manualResponse}
                  onChange={e => setManualResponse(e.target.value.toUpperCase())}
                  placeholder={`Ej: ${current.pattern}`}
                  className="w-full h-12 text-center text-2xl font-mono uppercase tracking-widest rounded-md border border-[var(--input)] bg-[var(--background)] mt-2"
                  maxLength={current.pattern.length}
                />
              </div>

              <div className="flex gap-3 justify-center">
                <Button size="lg" variant="destructive" onClick={() => handleMark(false)}>
                  <X className="w-5 h-5" /> Incorrecto
                </Button>
                <Button size="lg" variant="outline" onClick={handleSkip}>
                  <SkipForward className="w-5 h-5" /> Saltar
                </Button>
                <Button size="lg" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => handleMark(true)}>
                  <Check className="w-5 h-5" /> Correcto
                </Button>
              </div>

              {!isTestPhase && (
                <Button variant="ghost" className="mt-4" onClick={handleSkipToTest}>
                  Saltar a fase de test →
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {(state.finished || allTestAnswered) && (
        <Card className="border-[var(--primary)]">
          <CardHeader>
            <CardTitle>Finalizar evaluación</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="text-center p-4 bg-[var(--secondary)] rounded-lg">
                <div className="text-xs text-[var(--muted-foreground)]">Práctica</div>
                <div className="text-3xl font-bold">{scores ? `${percent(scores.practice.score, 1)}%` : '—'}</div>
              </div>
              <div className="text-center p-4 bg-[var(--primary)]/10 rounded-lg">
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
    </div>
  )
}
