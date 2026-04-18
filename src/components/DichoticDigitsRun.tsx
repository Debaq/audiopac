import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Play, Check, X, StopCircle, Keyboard, AlertTriangle, Flag, ArrowRight, Ear as EarIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { finishSession, cancelSession, saveResponse, listResponses } from '@/lib/db/sessions'
import { getStimulusListByCode, listStimuli } from '@/lib/db/stimuli'
import { DichoticDigitsController, type DichoticState } from '@/lib/audio/dichoticDigitsRunner'
import { ensureRunning, type CalibCurvePoint } from '@/lib/audio/engine'
import { useKeyboard, Kbd } from '@/hooks/useKeyboard'
import type { TestSession, TestTemplateParsed, Patient, DichoticDigitsParams } from '@/types'
import { cn } from '@/lib/utils'

interface Props {
  session: TestSession
  template: TestTemplateParsed
  patient: Patient
  params: DichoticDigitsParams
}

export function DichoticDigitsRun({ session, template, patient, params }: Props) {
  const navigate = useNavigate()
  const sid = session.id

  const [loadError, setLoadError] = useState<string | null>(null)
  const ctrlRef = useRef<DichoticDigitsController | null>(null)
  const [state, setState] = useState<DichoticState | null>(null)
  const [notes, setNotes] = useState('')
  const [finishing, setFinishing] = useState(false)
  const [flash, setFlash] = useState<'left' | 'right' | 'both' | null>(null)
  const [showHelp, setShowHelp] = useState(false)
  const [revealTokens, setRevealTokens] = useState(false)

  // Para modo directed: oído a reportar primero (alterna o se elige por evaluador)
  const [firstEar, setFirstEar] = useState<'left' | 'right'>('left')

  useEffect(() => {
    (async () => {
      const list = await getStimulusListByCode(params.stimulus_list_code)
      if (!list) { setLoadError(`Lista no encontrada: ${params.stimulus_list_code}`); return }
      const items = await listStimuli(list.id)
      const withAudio = items.filter(s => s.file_path)
      const minNeeded = params.digits_per_ear * 2
      if (withAudio.length < minNeeded) {
        setLoadError(`Lista "${list.name}" tiene solo ${withAudio.length} dígitos grabados. Se requieren al menos ${minNeeded} para formar pares dicóticos.`)
        return
      }
      let curve: CalibCurvePoint[] | undefined
      if (session.calibration_curve_snapshot) {
        try { curve = JSON.parse(session.calibration_curve_snapshot) } catch { curve = undefined }
      }
      const ctrl = new DichoticDigitsController(params, withAudio, session.ref_db_snapshot ?? undefined, curve)
      ctrlRef.current = ctrl
      const prev = await listResponses(sid)
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

  const current = useMemo(() => {
    if (!state) return null
    return state.pairs[state.currentIndex] ?? null
  }, [state])

  const scores = useMemo(() => {
    if (!state) return null
    const answered = state.pairs.filter(p => p.left_correct !== undefined && p.right_correct !== undefined)
    const lc = answered.filter(p => p.left_correct).length
    const rc = answered.filter(p => p.right_correct).length
    const total = state.pairs.length
    let asym: number | null = null
    if (answered.length > 0) {
      const lPct = (lc / answered.length) * 100
      const rPct = (rc / answered.length) * 100
      asym = rPct - lPct
    }
    return { leftCorrect: lc, rightCorrect: rc, answered: answered.length, total, asymmetryPct: asym }
  }, [state])

  const handlePlay = async () => {
    const ctrl = ctrlRef.current
    if (!ctrl || ctrl.state.finished || ctrl.state.isPlaying) return
    await ensureRunning()
    setRevealTokens(true)
    await ctrl.play()
  }

  const handleMark = async (leftCorrect: boolean, rightCorrect: boolean) => {
    const ctrl = ctrlRef.current
    if (!ctrl || ctrl.state.isPlaying) return
    const pair = ctrl.currentPair()
    if (!pair) return
    ctrl.answer(leftCorrect, rightCorrect)
    if (leftCorrect && rightCorrect) setFlash('both')
    else if (leftCorrect) setFlash('left')
    else if (rightCorrect) setFlash('right')
    else setFlash(null)
    setTimeout(() => setFlash(null), 400)

    const expected = `L:${pair.left_tokens.join(',')}|R:${pair.right_tokens.join(',')}`
    const given = `L:${leftCorrect ? '1' : '0'}|R:${rightCorrect ? '1' : '0'}`
    const both = leftCorrect && rightCorrect
    await saveResponse({
      session_id: sid,
      item_index: pair.index,
      phase: 'test',
      expected_pattern: expected,
      given_pattern: given,
      is_correct: both,
      reaction_time_ms: pair.presented_at ? Date.now() - pair.presented_at : null,
    })
    setRevealTokens(false)
    // Alternar oído inicial si modo directed
    if (params.mode === 'directed') setFirstEar(e => e === 'left' ? 'right' : 'left')
    ctrl.next()
  }

  const handleCancel = async () => {
    if (!confirm('¿Cancelar evaluación?')) return
    await cancelSession(sid)
    navigate('/evaluacion')
  }

  const handleFinishManual = () => {
    if (!ctrlRef.current) return
    if (!confirm('¿Terminar ahora? Se guardarán los pares respondidos hasta aquí.')) return
    ctrlRef.current.finishManual()
  }

  const handleSave = async () => {
    const ctrl = ctrlRef.current
    if (!ctrl) return
    setFinishing(true)
    try {
      const s = ctrl.getScores()
      const leftPct = s.answered > 0 ? s.leftCorrect / s.answered : 0
      const rightPct = s.answered > 0 ? s.rightCorrect / s.answered : 0
      const totalCorrect = s.leftCorrect + s.rightCorrect
      const totalPresented = s.answered * 2
      const bothCorrect = ctrl.state.pairs.filter(p => p.left_correct && p.right_correct).length
      const notesPrefix = `Dichotic Digits — L: ${Math.round(leftPct * 100)}% · R: ${Math.round(rightPct * 100)}% · Asim(R-L): ${s.asymmetryPct !== null ? s.asymmetryPct.toFixed(1) + '%' : '—'}. `
      await finishSession(sid, {
        practice_score: 0,
        test_score: totalPresented > 0 ? totalCorrect / totalPresented : 0,
        total_items: s.answered,
        correct_items: bothCorrect,
        notes: notesPrefix + (notes || ''),
      })
      navigate(`/informes/${sid}`)
    } finally {
      setFinishing(false)
    }
  }

  useKeyboard([
    { keys: [' '], handler: handlePlay },
    { keys: ['1'], handler: () => handleMark(false, false) },
    { keys: ['2'], handler: () => handleMark(true, false) },
    { keys: ['3'], handler: () => handleMark(false, true) },
    { keys: ['4'], handler: () => handleMark(true, true) },
    { keys: ['?', 'h'], handler: () => setShowHelp(v => !v) },
    { keys: ['Escape'], handler: () => setShowHelp(false) },
  ], [state, params.mode])

  if (loadError) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
              <AlertTriangle className="w-5 h-5" /> No se puede iniciar Dichotic Digits
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>{loadError}</p>
            <p className="text-[var(--muted-foreground)]">
              Graba los dígitos de la lista antes de correr la prueba.
            </p>
            <div className="flex gap-2">
              <Button onClick={() => navigate('/estimulos')}>Ir a Estímulos</Button>
              <Button variant="outline" onClick={handleCancel}>Cancelar sesión</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!state) return <div className="p-8">Cargando Dichotic Digits...</div>

  const answeredCount = state.pairs.filter(p => p.left_correct !== undefined).length
  const progress = state.pairs.length > 0 ? (answeredCount / state.pairs.length) * 100 : 0

  return (
    <div className={cn(
      'min-h-screen transition-colors duration-300',
      flash === 'both' && 'bg-emerald-50 dark:bg-emerald-950/20',
      flash === 'left' && 'bg-sky-50 dark:bg-sky-950/20',
      flash === 'right' && 'bg-fuchsia-50 dark:bg-fuchsia-950/20',
    )}>
      <div className="p-8 max-w-5xl mx-auto">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-3xl font-black tracking-tight">{template.name}</h1>
            <p className="text-[var(--muted-foreground)]">
              {patient.last_name}, {patient.first_name} · Modo: <span className="font-medium">{params.mode === 'free' ? 'Libre' : 'Dirigido'}</span> · Dichotic Digits
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

        <div className="relative h-2 bg-[var(--secondary)] rounded-full overflow-hidden mb-6">
          <div
            className="h-full bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] transition-all duration-500 rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="grid grid-cols-4 gap-3 mb-6">
          <StatTile label="Par" value={`${Math.min(state.currentIndex + 1, state.pairs.length)}/${state.pairs.length}`} accent />
          <StatTile label="Aciertos L" value={scores ? `${scores.leftCorrect}/${scores.answered}` : '0/0'} />
          <StatTile label="Aciertos R" value={scores ? `${scores.rightCorrect}/${scores.answered}` : '0/0'} />
          <StatTile label="Asim. R-L" value={scores?.asymmetryPct !== null && scores?.asymmetryPct !== undefined ? `${scores.asymmetryPct.toFixed(0)}%` : '—'} big />
        </div>

        {!state.finished && current && (
          <Card className="mb-6 border-2 border-[var(--primary)]/20">
            <div className="h-1 bg-[var(--primary)]" />
            <CardContent className="p-8">
              {params.mode === 'directed' && (
                <div className="text-center mb-4">
                  <Badge className="text-sm">
                    Reportar primero oído <span className="uppercase ml-1">{firstEar === 'left' ? 'izquierdo' : 'derecho'}</span>
                  </Badge>
                </div>
              )}

              <div className="grid grid-cols-2 gap-6 mb-6">
                <EarBox
                  side="left"
                  tokens={current.left_tokens}
                  reveal={revealTokens || current.left_correct !== undefined}
                  correct={current.left_correct}
                />
                <EarBox
                  side="right"
                  tokens={current.right_tokens}
                  reveal={revealTokens || current.right_correct !== undefined}
                  correct={current.right_correct}
                />
              </div>

              <div className="flex gap-3 justify-center mb-6">
                <Button size="xl" onClick={handlePlay} disabled={state.isPlaying || current.left_correct !== undefined} className="min-w-[240px]">
                  <Play className="w-5 h-5" /> {state.isPlaying ? 'Reproduciendo...' : current.left_correct !== undefined ? 'Par presentado' : 'Presentar par dicótico'}
                  <Kbd className="ml-2 bg-white/20 border-white/30 text-white">Espacio</Kbd>
                </Button>
              </div>

              <div className="text-center text-xs uppercase tracking-widest text-[var(--muted-foreground)] mb-3">
                Marcar aciertos por oído
              </div>
              <div className="grid grid-cols-4 gap-3 max-w-3xl mx-auto">
                <Button variant="destructive" onClick={() => handleMark(false, false)} disabled={state.isPlaying}>
                  <X className="w-4 h-4" /> Ninguno <Kbd className="ml-1 bg-white/20 border-white/30 text-white">1</Kbd>
                </Button>
                <Button className="bg-sky-600 hover:bg-sky-700 text-white" onClick={() => handleMark(true, false)} disabled={state.isPlaying}>
                  Solo L <Kbd className="ml-1 bg-white/20 border-white/30 text-white">2</Kbd>
                </Button>
                <Button className="bg-fuchsia-600 hover:bg-fuchsia-700 text-white" onClick={() => handleMark(false, true)} disabled={state.isPlaying}>
                  Solo R <Kbd className="ml-1 bg-white/20 border-white/30 text-white">3</Kbd>
                </Button>
                <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => handleMark(true, true)} disabled={state.isPlaying}>
                  <Check className="w-4 h-4" /> Ambos <Kbd className="ml-1 bg-white/20 border-white/30 text-white">4</Kbd>
                </Button>
              </div>

              <div className="text-center mt-6">
                <Button variant="ghost" size="sm" onClick={handleFinishManual}>
                  <Flag className="w-4 h-4" /> Terminar ahora
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Historial de pares</CardTitle>
            <CardDescription>
              {params.num_pairs} pares · {params.digits_per_ear} dígito{params.digits_per_ear > 1 ? 's' : ''} por oído · Nivel {params.level_db} dB HL
            </CardDescription>
          </CardHeader>
          <CardContent>
            {answeredCount === 0 ? (
              <p className="text-sm text-[var(--muted-foreground)]">Aún sin datos. Presentá el primer par.</p>
            ) : (
              <div className="space-y-1">
                {state.pairs.map((p, i) => {
                  const isCurrent = i === state.currentIndex && !state.finished
                  const scored = p.left_correct !== undefined && p.right_correct !== undefined
                  return (
                    <div key={i} className={cn(
                      'flex items-center gap-3 p-2 rounded-md border text-sm',
                      isCurrent && 'border-[var(--primary)]/60 bg-[var(--primary)]/5',
                      !isCurrent && scored && 'border-[var(--border)]/50',
                      !isCurrent && !scored && 'border-dashed border-[var(--border)]/30 opacity-60'
                    )}>
                      <span className="font-mono w-10 text-[var(--muted-foreground)]">#{i + 1}</span>
                      <span className="font-mono flex-1">
                        <span className="text-sky-600 dark:text-sky-400">L: {p.left_tokens.join(' ')}</span>
                        <span className="mx-2 text-[var(--muted-foreground)]">/</span>
                        <span className="text-fuchsia-600 dark:text-fuchsia-400">R: {p.right_tokens.join(' ')}</span>
                      </span>
                      {scored && (
                        <>
                          <Badge className={p.left_correct ? 'bg-sky-500' : 'bg-red-500/70'}>
                            L {p.left_correct ? '✓' : '✗'}
                          </Badge>
                          <Badge className={p.right_correct ? 'bg-fuchsia-500' : 'bg-red-500/70'}>
                            R {p.right_correct ? '✓' : '✗'}
                          </Badge>
                        </>
                      )}
                      {isCurrent && <Badge>actual</Badge>}
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
              <CardDescription>Totales por oído y asimetría (R − L).</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="text-center p-4 bg-sky-500/10 border border-sky-500/30 rounded-lg">
                  <div className="text-xs text-[var(--muted-foreground)] uppercase">Oído Izquierdo</div>
                  <div className="text-3xl font-black text-sky-600 dark:text-sky-400">
                    {scores && scores.answered > 0 ? `${Math.round((scores.leftCorrect / scores.answered) * 100)}%` : '—'}
                  </div>
                  <div className="text-xs text-[var(--muted-foreground)]">{scores?.leftCorrect ?? 0}/{scores?.answered ?? 0}</div>
                </div>
                <div className="text-center p-4 bg-fuchsia-500/10 border border-fuchsia-500/30 rounded-lg">
                  <div className="text-xs text-[var(--muted-foreground)] uppercase">Oído Derecho</div>
                  <div className="text-3xl font-black text-fuchsia-600 dark:text-fuchsia-400">
                    {scores && scores.answered > 0 ? `${Math.round((scores.rightCorrect / scores.answered) * 100)}%` : '—'}
                  </div>
                  <div className="text-xs text-[var(--muted-foreground)]">{scores?.rightCorrect ?? 0}/{scores?.answered ?? 0}</div>
                </div>
                <div className="text-center p-4 bg-gradient-to-br from-[var(--primary)]/20 to-[var(--accent)]/20 rounded-lg">
                  <div className="text-xs text-[var(--muted-foreground)] uppercase">Asimetría R − L</div>
                  <div className="text-3xl font-black text-[var(--primary)]">
                    {scores?.asymmetryPct !== null && scores?.asymmetryPct !== undefined ? `${scores.asymmetryPct > 0 ? '+' : ''}${scores.asymmetryPct.toFixed(1)}%` : '—'}
                  </div>
                </div>
              </div>
              <Label>Observaciones</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4} placeholder="Observaciones clínicas, comportamiento, preferencia de oído, etc." />
              <Button size="lg" className="w-full mt-4" onClick={handleSave} disabled={finishing}>
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

function EarBox({ side, tokens, reveal, correct }: { side: 'left' | 'right'; tokens: string[]; reveal: boolean; correct?: boolean }) {
  const bg = side === 'left' ? 'from-sky-500/10 to-sky-500/5 border-sky-500/40' : 'from-fuchsia-500/10 to-fuchsia-500/5 border-fuchsia-500/40'
  const fg = side === 'left' ? 'text-sky-700 dark:text-sky-300' : 'text-fuchsia-700 dark:text-fuchsia-300'
  return (
    <div className={cn('rounded-xl border-2 p-5 bg-gradient-to-br', bg)}>
      <div className="flex items-center justify-between mb-3">
        <div className={cn('flex items-center gap-2 text-xs uppercase tracking-widest font-bold', fg)}>
          <EarIcon className={cn('w-4 h-4', side === 'right' && 'scale-x-[-1]')} />
          {side === 'left' ? 'Izquierdo' : 'Derecho'}
        </div>
        {correct !== undefined && (
          <Badge className={correct ? 'bg-emerald-500' : 'bg-red-500'}>
            {correct ? '✓' : '✗'}
          </Badge>
        )}
      </div>
      <div className="min-h-[72px] flex items-center justify-center gap-3 flex-wrap">
        {reveal ? (
          tokens.map((t, i) => (
            <div key={i} className={cn('px-4 py-2 rounded-lg bg-[var(--card)] border font-mono font-bold text-2xl', fg)}>
              {t}
              {i < tokens.length - 1 && <ArrowRight className="inline w-4 h-4 ml-2 text-[var(--muted-foreground)]" />}
            </div>
          ))
        ) : (
          <span className="text-[var(--muted-foreground)] text-lg">— oculto hasta presentar —</span>
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
    [['Espacio'], 'Presentar par dicótico'],
    [['1'], 'Ninguno correcto'],
    [['2'], 'Solo oído izquierdo correcto'],
    [['3'], 'Solo oído derecho correcto'],
    [['4'], 'Ambos oídos correctos'],
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
