import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Play, StopCircle, AlertTriangle, RotateCcw, Ear } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { finishSession, cancelSession, saveResponse, listResponses } from '@/lib/db/sessions'
import { getStimulusListByCode, listStimuli } from '@/lib/db/stimuli'
import { SSWController, type SSWState, type SSWTrial, type SSWCondition } from '@/lib/audio/sswRunner'
import { ensureRunning, type CalibCurvePoint } from '@/lib/audio/engine'
import { PreviewBanner } from '@/components/PreviewBanner'
import type { TestSession, TestTemplateParsed, Patient, SSWParams } from '@/types'
import { cn } from '@/lib/utils'

interface Props {
  session: TestSession
  template: TestTemplateParsed
  patient: Patient
  params: SSWParams
  preview?: boolean
}

const SLOTS: SSWCondition[] = ['RNC', 'RC', 'LC', 'LNC']
const SLOT_LABELS: Record<SSWCondition, string> = {
  RNC: 'RNC · R-1 (aislado)',
  RC: 'RC · R-2 (competing)',
  LC: 'LC · L-1 (competing)',
  LNC: 'LNC · L-2 (aislado)',
}

function emptyInputs(): Record<SSWCondition, string> {
  return { RNC: '', RC: '', LC: '', LNC: '' }
}

export function SSWRun({ session, template, patient, params, preview = false }: Props) {
  const navigate = useNavigate()
  const sid = session.id

  const ctrlRef = useRef<SSWController | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [state, setState] = useState<SSWState | null>(null)
  const [inputs, setInputs] = useState<Record<SSWCondition, string>>(emptyInputs())
  const [reversal, setReversal] = useState(false)
  const [notes, setNotes] = useState('')
  const [finishing, setFinishing] = useState(false)

  useEffect(() => {
    (async () => {
      const list = await getStimulusListByCode(params.stimulus_list_code)
      if (!list) { setLoadError(`Lista no encontrada: ${params.stimulus_list_code}`); return }
      const items = await listStimuli(list.id)
      let curve: CalibCurvePoint[] | undefined
      if (session.calibration_curve_snapshot) {
        try { curve = JSON.parse(session.calibration_curve_snapshot) } catch { /* noop */ }
      }
      const ctrl = new SSWController(params, items, session.ref_db_snapshot ?? undefined, curve, preview)
      if (ctrl.state.trials.length === 0) {
        setLoadError('La lista no tiene ítems SSW (requiere metadata ssw_item/side/position en los estímulos).')
        return
      }
      if (!preview && ctrl.readyItems() < ctrl.state.trials.length) {
        setLoadError(`Sólo ${ctrl.readyItems()}/${ctrl.state.trials.length} ítems tienen las 4 grabaciones. Completá la lista antes de iniciar.`)
        return
      }
      ctrlRef.current = ctrl
      const prev = preview ? [] : await listResponses(sid)
      if (prev.length > 0) {
        ctrl.hydrate(prev.map(r => ({
          item_index: r.item_index,
          expected_pattern: r.expected_pattern,
          given_pattern: r.given_pattern,
          is_correct: r.is_correct,
          phase: r.phase,
        })))
      }
      setState({ ...ctrl.state })
      const unsub = ctrl.subscribe(setState)
      return () => { unsub() }
    })()
  }, [sid])

  const trial: SSWTrial | null = useMemo(() => {
    if (!state) return null
    return state.trials[state.currentIndex] ?? null
  }, [state])

  const alreadyAnswered = !!trial?.given

  const handlePlay = async () => {
    const c = ctrlRef.current
    if (!c || c.state.finished || c.state.isPlaying) return
    await ensureRunning()
    setInputs(emptyInputs())
    setReversal(false)
    await c.playCurrent()
  }

  const handleSubmit = async () => {
    const c = ctrlRef.current
    if (!c || !trial || alreadyAnswered) return
    const given: Record<SSWCondition, string | null> = {
      RNC: inputs.RNC.trim() || null,
      RC: inputs.RC.trim() || null,
      LC: inputs.LC.trim() || null,
      LNC: inputs.LNC.trim() || null,
    }
    const t = c.answer(given, reversal)
    if (!t) return
    const allCorrect = t.correct && SLOTS.every(s => t.correct![s])
    if (!preview) {
      await saveResponse({
        session_id: sid,
        item_index: t.index,
        phase: 'test',
        expected_pattern: c.serializeExpected(t),
        given_pattern: c.serializeGiven(t),
        is_correct: !!allCorrect,
        reaction_time_ms: t.presented_at ? Date.now() - t.presented_at : null,
      })
    }
    // Si hay catch trial pendiente, next() queda bloqueado hasta que el usuario responda.
    if (!c.state.pendingCatch) {
      c.next()
      setInputs(emptyInputs())
      setReversal(false)
    }
  }

  const handleCatchAnswer = async (ear: 'R' | 'L') => {
    const c = ctrlRef.current
    if (!c || !c.state.pendingCatch) return
    const pending = c.state.pendingCatch
    const resp = c.answerCatch(ear)
    if (resp && !preview) {
      await saveResponse({
        session_id: sid,
        item_index: pending.after_index,
        phase: 'catch',
        expected_pattern: resp.asked_ear_first,
        given_pattern: resp.answered,
        is_correct: resp.correct,
        reaction_time_ms: null,
      })
    }
    c.next()
    setInputs(emptyInputs())
    setReversal(false)
  }

  const handleMarkAllCorrect = () => {
    if (!trial) return
    setInputs({ ...trial.expected })
  }

  const handleCancel = async () => {
    if (preview) { navigate(`/tests?id=${template.id}`); return }
    if (!confirm('¿Cancelar evaluación?')) return
    await cancelSession(sid)
    navigate('/evaluacion')
  }

  const handleSave = async () => {
    const c = ctrlRef.current
    if (!c) return
    if (preview) { navigate(`/tests?id=${template.id}`); return }
    setFinishing(true)
    try {
      const score = c.finalize()
      const correctItems = c.state.trials.filter(t => t.correct && SLOTS.every(s => t.correct![s])).length
      await finishSession(sid, {
        practice_score: 0,
        test_score: 100 - score.raw_score_pct,
        total_items: score.total_items,
        correct_items: score.total_items - score.total_errors,
        notes: `SSW: ${score.total_errors}/${score.total_items} errores (${score.raw_score_pct.toFixed(1)}%). Ear effect: ${score.ear_effect_pct.toFixed(1)}%. Reversals: ${score.reversals}. Ítems perfectos: ${correctItems}.${score.catch_total ? ` Catch attention: ${score.catch_correct}/${score.catch_total} (${(score.catch_accuracy_pct ?? 0).toFixed(0)}%).` : ''} ${notes}`,
      })
      navigate(`/informes/${sid}`)
    } finally {
      setFinishing(false)
    }
  }

  // Atajo: Enter para submit si todos los slots tienen texto
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ctrl = ctrlRef.current
      if (ctrl?.state.pendingCatch && !e.ctrlKey && !e.metaKey) {
        const target = e.target as HTMLElement
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
        if (e.key.toLowerCase() === 'r') { e.preventDefault(); handleCatchAnswer('R'); return }
        if (e.key.toLowerCase() === 'l') { e.preventDefault(); handleCatchAnswer('L'); return }
      }
      if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        const target = e.target as HTMLElement
        if (target.tagName === 'TEXTAREA') return
        e.preventDefault()
        handleSubmit()
      } else if (e.key.toLowerCase() === 'r' && e.ctrlKey) {
        e.preventDefault()
        handlePlay()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (loadError) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
              <AlertTriangle className="w-5 h-5" /> No se puede iniciar SSW
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>{loadError}</p>
            <div className="flex gap-2">
              <Button onClick={() => navigate('/estimulos')}>Ir a Estímulos</Button>
              <Button variant="outline" onClick={handleCancel}>Cancelar sesión</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!state || !trial) return <div className="p-8">Cargando SSW…</div>

  const totalTrials = state.trials.length
  const current = state.currentIndex + 1
  const answeredCount = state.trials.filter(t => t.given).length

  return (
    <div className="min-h-screen">
      <div className="p-8 max-w-6xl mx-auto">
        {preview && <PreviewBanner />}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-3xl font-black tracking-tight">{template.name}</h1>
            <p className="text-[var(--muted-foreground)]">
              {patient.last_name}, {patient.first_name} · SSW · Nivel {params.level_db} dB HL
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleCancel}>
            <StopCircle className="w-4 h-4" /> Cancelar
          </Button>
        </div>

        <div className="grid grid-cols-4 gap-3 mb-6">
          <StatTile label="Trial" value={`${current}/${totalTrials}`} accent />
          <StatTile label="Ear-first" value={trial.ear_first} />
          <StatTile label="Respondidos" value={`${answeredCount}`} />
          <StatTile label="Pair" value={trial.pair_label ?? `#${trial.item_id}`} />
        </div>

        {!state.finished && state.pendingCatch && (
          <Card className="mb-6 border-2 border-amber-500/40 bg-amber-500/5">
            <div className="h-1 bg-amber-500" />
            <CardContent className="p-6 space-y-4 text-center">
              <div className="text-xs uppercase tracking-widest text-amber-700 dark:text-amber-300">Chequeo de atención</div>
              <h2 className="text-2xl font-bold">¿En qué oído escuchaste primero el ítem anterior?</h2>
              <p className="text-xs text-[var(--muted-foreground)]">
                Catch trial · no afecta el scoring SSW, sólo valida atención. Atajos: <b>R</b> derecho · <b>L</b> izquierdo.
              </p>
              <div className="flex gap-4 justify-center">
                <Button size="xl" variant="outline" onClick={() => handleCatchAnswer('L')} className="min-w-[160px]">
                  <Ear className="w-5 h-5" /> Izquierdo (L)
                </Button>
                <Button size="xl" variant="outline" onClick={() => handleCatchAnswer('R')} className="min-w-[160px]">
                  <Ear className="w-5 h-5" /> Derecho (R)
                </Button>
              </div>
              {state.catchResponses.length > 0 && (
                <div className="text-[11px] text-[var(--muted-foreground)]">
                  Hasta ahora: {state.catchResponses.filter(c => c.correct).length}/{state.catchResponses.length} correctos
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {!state.finished && !state.pendingCatch && (
          <Card className="mb-6 border-2 border-[var(--primary)]/20">
            <div className="h-1 bg-[var(--primary)]" />
            <CardContent className="p-6 space-y-4">
              <div className="text-center">
                <div className="text-xs uppercase tracking-widest text-[var(--muted-foreground)] mb-1">
                  Ítem {trial.item_id} · ear-first <b>{trial.ear_first}</b>
                </div>
                {params.show_pair_label && trial.pair_label && (
                  <div className="text-sm text-[var(--muted-foreground)]">Esperado: <b>{trial.pair_label}</b></div>
                )}
              </div>

              <div className="flex justify-center">
                <Button size="xl" onClick={handlePlay} disabled={state.isPlaying || alreadyAnswered} className="min-w-[240px]">
                  <Play className="w-5 h-5" /> {state.isPlaying ? 'Reproduciendo…' : alreadyAnswered ? 'Respondido' : 'Reproducir ítem'}
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {SLOTS.map(slot => {
                  const expected = trial.expected[slot]
                  const correctFlag = trial.correct?.[slot]
                  return (
                    <div key={slot} className={cn(
                      'border-2 rounded-lg p-3 space-y-1',
                      alreadyAnswered && correctFlag === true && 'border-emerald-500/50 bg-emerald-500/5',
                      alreadyAnswered && correctFlag === false && 'border-red-500/50 bg-red-500/5',
                      !alreadyAnswered && 'border-[var(--border)]',
                    )}>
                      <Label className="text-[10px] font-bold uppercase tracking-wider">{SLOT_LABELS[slot]}</Label>
                      <Input
                        value={inputs[slot]}
                        onChange={e => setInputs(prev => ({ ...prev, [slot]: e.target.value }))}
                        placeholder={expected}
                        disabled={alreadyAnswered}
                        className="text-sm"
                      />
                      <div className="text-[10px] text-[var(--muted-foreground)]">
                        Esperado: <span className="font-mono">{expected}</span>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={reversal}
                    onChange={e => setReversal(e.target.checked)}
                    disabled={alreadyAnswered}
                  />
                  Reversal (orden de reporte invertido)
                </label>
                <Button variant="outline" size="sm" onClick={handleMarkAllCorrect} disabled={alreadyAnswered}>
                  <RotateCcw className="w-3.5 h-3.5" /> Pre-llenar con esperado
                </Button>
              </div>

              <div className="flex gap-3 justify-center">
                <Button size="lg" onClick={handleSubmit} disabled={alreadyAnswered || state.isPlaying} className="bg-emerald-600 hover:bg-emerald-700 text-white min-w-[180px]">
                  Confirmar y siguiente
                </Button>
              </div>

              <p className="text-[10px] text-center text-[var(--muted-foreground)]">
                Atajos: <b>Enter</b> confirma · <b>Ctrl+R</b> reproduce. Auto-scoring normaliza acentos y mayúsculas.
              </p>
            </CardContent>
          </Card>
        )}

        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Progreso por condición</CardTitle>
            <CardDescription>Errores parciales actualizados en vivo.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-3">
              {SLOTS.map(slot => {
                const total = state.trials.filter(t => t.correct).length
                const correct = state.trials.filter(t => t.correct?.[slot]).length
                return (
                  <div key={slot} className="border rounded-md p-2 text-center">
                    <div className="text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">{slot}</div>
                    <div className="text-sm font-bold">{correct}/{total}</div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {state.finished && state.score && (
          <Card className="border-2 border-[var(--primary)]">
            <CardHeader>
              <CardTitle>Resultado SSW</CardTitle>
              <CardDescription>
                {state.score.total_errors}/{state.score.total_items} errores · {state.score.raw_score_pct.toFixed(1)}% raw
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-4 gap-2">
                {SLOTS.map(slot => {
                  const c = state.score!.by_condition[slot]
                  return (
                    <div key={slot} className="rounded-md border p-2 text-center">
                      <div className="text-[10px] uppercase text-[var(--muted-foreground)]">{slot}</div>
                      <div className="text-lg font-black">{c.error_pct.toFixed(1)}%</div>
                      <div className="text-[10px] text-[var(--muted-foreground)]">{c.total - c.correct}/{c.total} err</div>
                    </div>
                  )
                })}
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="rounded border p-2">Ear effect: <b>{state.score.ear_effect_pct.toFixed(1)}%</b></div>
                <div className="rounded border p-2">Order effect: <b>{state.score.order_effect_pct.toFixed(1)}%</b></div>
                <div className="rounded border p-2">Reversals: <b>{state.score.reversals}</b></div>
              </div>
              {state.score.catch_total !== undefined && state.score.catch_total > 0 && (
                <div className={cn(
                  'rounded border p-2 text-xs',
                  (state.score.catch_accuracy_pct ?? 0) < 80
                    ? 'border-amber-500/50 bg-amber-500/5'
                    : 'border-emerald-500/30 bg-emerald-500/5',
                )}>
                  Catch trials de atención: <b>{state.score.catch_correct}/{state.score.catch_total}</b>
                  {' · '}
                  <b>{(state.score.catch_accuracy_pct ?? 0).toFixed(0)}%</b>
                  {(state.score.catch_accuracy_pct ?? 0) < 80 && ' — precisión baja, interpretar con cautela'}
                </div>
              )}
              {state.score.qualifiers.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {state.score.qualifiers.map(q => <Badge key={q} variant="outline">{q}</Badge>)}
                </div>
              )}
              <Label>Observaciones</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4} placeholder="Observaciones clínicas…" />
              <Button size="lg" className="w-full" onClick={handleSave} disabled={finishing}>
                {preview ? 'Cerrar vista previa' : finishing ? 'Guardando…' : 'Finalizar y generar informe'}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

function StatTile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={cn(
      'rounded-xl p-3 text-center border',
      accent ? 'bg-gradient-to-br from-[var(--primary)]/10 to-[var(--accent)]/10 border-[var(--primary)]/30' : 'bg-[var(--card)] border-[var(--border)]',
    )}>
      <div className="text-[10px] uppercase tracking-wider text-[var(--muted-foreground)] font-semibold">{label}</div>
      <div className="font-black mt-1 text-lg truncate">{value}</div>
    </div>
  )
}
