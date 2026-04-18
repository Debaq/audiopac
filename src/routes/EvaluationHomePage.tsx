import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Activity, Ear as EarIcon, Clock, Play, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { PatientCombobox } from '@/components/PatientCombobox'
import { TestCombobox } from '@/components/TestCombobox'
import { listTemplates } from '@/lib/db/templates'
import { createSession, listInProgressSessions, cancelSession } from '@/lib/db/sessions'
import { getActiveCalibration, getActiveCurve } from '@/lib/db/calibrations'
import { PreSessionCheck } from '@/components/PreSessionCheck'
import { useAuth } from '@/stores/auth'
import type { TestTemplateParsed, Ear, ResponseMode, SessionWithDetails } from '@/types'
import { formatDateTime } from '@/lib/utils'

export function EvaluationHomePage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const profile = useAuth(s => s.activeProfile)

  const [templates, setTemplates] = useState<TestTemplateParsed[]>([])
  const [pending, setPending] = useState<SessionWithDetails[]>([])
  const [patientId, setPatientId] = useState<number | null>(null)
  const [templateId, setTemplateId] = useState<number | null>(null)
  const [ear, setEar] = useState<Ear>('binaural')
  const [responseMode, setResponseMode] = useState<ResponseMode>('manual')
  const [starting, setStarting] = useState(false)
  const [showCheck, setShowCheck] = useState(false)

  useEffect(() => {
    Promise.all([listTemplates(true), listInProgressSessions()]).then(([t, ip]) => {
      setTemplates(t)
      setPending(ip)
      const urlP = params.get('patient')
      if (urlP) setPatientId(Number(urlP))
      const urlT = params.get('template')
      if (urlT) setTemplateId(Number(urlT))
    })
  }, [])

  const discardPending = async (id: number) => {
    if (!confirm('¿Descartar evaluación pendiente? No se podrá retomar.')) return
    await cancelSession(id)
    setPending(prev => prev.filter(s => s.id !== id))
  }

  const selectedTemplate = useMemo(
    () => templates.find(t => t.id === templateId) ?? null,
    [templates, templateId]
  )

  const requestStart = () => {
    if (!patientId || !templateId || !profile) return
    setShowCheck(true)
  }

  const start = async () => {
    if (!patientId || !templateId || !profile) return
    setShowCheck(false)
    setStarting(true)
    try {
      const tmpl = templates.find(t => t.id === templateId)!
      const [cal, curve] = await Promise.all([getActiveCalibration(), getActiveCurve()])
      const curveSnap = curve.length > 0
        ? JSON.stringify(curve.map(p => ({ frequency_hz: p.frequency_hz, ear: p.ear, ref_db_spl: p.ref_db_spl })))
        : null
      const sid = await createSession({
        patient_id: patientId,
        template_id: templateId,
        profile_id: profile.id,
        ear,
        response_mode: responseMode,
        config_snapshot: JSON.stringify(tmpl.config),
        calibration_id: cal?.id ?? null,
        ref_db_snapshot: cal?.ref_db_spl ?? null,
        calibration_curve_snapshot: curveSnap,
      })
      navigate(`/evaluacion/${sid}`)
    } finally {
      setStarting(false)
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Nueva evaluación</h1>
        <p className="text-[var(--muted-foreground)]">Configura los parámetros e inicia el test</p>
      </div>

      {pending.length > 0 && (
        <Card className="mb-6 border-2 border-amber-400/60 bg-amber-50/50 dark:bg-amber-950/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-900 dark:text-amber-200">
              <Clock className="w-5 h-5" /> Evaluaciones pendientes ({pending.length})
            </CardTitle>
            <CardDescription>Sesiones iniciadas sin finalizar. Retoma donde las dejaste.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {pending.map(s => (
              <div key={s.id} className="flex items-center justify-between p-3 rounded-lg bg-[var(--card)] border border-[var(--border)]">
                <div>
                  <div className="font-semibold">{s.patient_name}</div>
                  <div className="text-xs text-[var(--muted-foreground)]">
                    {s.template_name} · Oído: {s.ear} · {formatDateTime(s.started_at)}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => navigate(`/evaluacion/${s.id}`)}>
                    <Play className="w-4 h-4" /> Retomar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => discardPending(s.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="mb-6">
        <CardHeader><CardTitle>Paciente y test</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Paciente</Label>
            <PatientCombobox value={patientId} onChange={setPatientId} autoFocus />
          </div>
          <div>
            <Label>Test</Label>
            <TestCombobox templates={templates} value={templateId} onChange={setTemplateId} />
            {selectedTemplate && (
              <p className="text-sm text-[var(--muted-foreground)] mt-2">{selectedTemplate.description}</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><EarIcon className="w-5 h-5" /> Condiciones</CardTitle>
          <CardDescription>Oído y modo de respuesta</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div>
            <Label>Oído</Label>
            <Select value={ear} onChange={e => setEar(e.target.value as Ear)}>
              <option value="binaural">Binaural (ambos)</option>
              <option value="right">Derecho</option>
              <option value="left">Izquierdo</option>
            </Select>
          </div>
          <div>
            <Label>Modo de respuesta</Label>
            <Select value={responseMode} onChange={e => setResponseMode(e.target.value as ResponseMode)}>
              <option value="manual">Manual (profesional marca)</option>
              <option value="verbal">Verbal (paciente verbaliza)</option>
              <option value="hummed">Tarareo</option>
            </Select>
          </div>
        </CardContent>
      </Card>

      {selectedTemplate && (
        <Card className="mb-6 bg-[var(--secondary)]">
          <CardHeader><CardTitle className="text-base">Parámetros del test</CardTitle></CardHeader>
          <CardContent>
            <TemplateSummary config={selectedTemplate.config} />
          </CardContent>
        </Card>
      )}

      <Button size="lg" className="w-full" disabled={!patientId || !templateId || starting} onClick={requestStart}>
        <Activity className="w-5 h-5" /> {starting ? 'Iniciando...' : 'Iniciar evaluación'}
      </Button>

      {showCheck && (
        <PreSessionCheck onProceed={start} onCancel={() => setShowCheck(false)} />
      )}
    </div>
  )
}

function TemplateSummary({ config }: { config: import('@/types').TestConfig }) {
  if (config.dichotic_digits) {
    const d = config.dichotic_digits
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
        <div><span className="text-[var(--muted-foreground)]">Modo:</span> Dichotic Digits</div>
        <div><span className="text-[var(--muted-foreground)]">Lista:</span> {d.stimulus_list_code}</div>
        <div><span className="text-[var(--muted-foreground)]">Pares:</span> {d.num_pairs}</div>
        <div><span className="text-[var(--muted-foreground)]">Dígitos/oído:</span> {d.digits_per_ear}</div>
        <div><span className="text-[var(--muted-foreground)]">ISI:</span> {d.isi_ms} ms</div>
        <div><span className="text-[var(--muted-foreground)]">Nivel:</span> {d.level_db} dB HL</div>
        <div><span className="text-[var(--muted-foreground)]">Recuerdo:</span> {d.mode === 'free' ? 'Libre' : 'Dirigido'}</div>
      </div>
    )
  }
  if (config.srt) {
    const s = config.srt
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
        <div><span className="text-[var(--muted-foreground)]">Modo:</span> SRT adaptativo</div>
        <div><span className="text-[var(--muted-foreground)]">Lista:</span> {s.stimulus_list_code}</div>
        <div><span className="text-[var(--muted-foreground)]">Nivel inicial:</span> {s.start_level_db} dB HL</div>
        <div><span className="text-[var(--muted-foreground)]">Palabras/nivel:</span> {s.words_per_level}</div>
        <div><span className="text-[var(--muted-foreground)]">Descenso:</span> {s.step_down_db} dB</div>
        <div><span className="text-[var(--muted-foreground)]">Ascenso:</span> {s.step_up_db} dB</div>
        <div><span className="text-[var(--muted-foreground)]">Umbral pase:</span> {Math.round(s.threshold_pass_ratio * 100)}%</div>
        <div><span className="text-[var(--muted-foreground)]">Rango:</span> {s.min_level_db}–{s.max_level_db} dB</div>
      </div>
    )
  }
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
      <div><span className="text-[var(--muted-foreground)]">Longitud patrón:</span> {config.pattern_length} tonos</div>
      <div><span className="text-[var(--muted-foreground)]">Práctica:</span> {config.practice_sequences.length} ítems</div>
      <div><span className="text-[var(--muted-foreground)]">Test:</span> {config.test_sequences.length} ítems</div>
      <div><span className="text-[var(--muted-foreground)]">ISI:</span> {config.isi_ms} ms</div>
      <div><span className="text-[var(--muted-foreground)]">IRI:</span> {config.iri_ms} ms</div>
      <div><span className="text-[var(--muted-foreground)]">Nivel:</span> {config.level_db} dB</div>
      {Object.entries(config.tones).map(([k, t]) => (
        <div key={k}><span className="text-[var(--muted-foreground)]">{k} ({t.label}):</span> {t.frequency ?? config.frequency} Hz{t.duration_ms ? ` / ${t.duration_ms} ms` : config.duration_ms ? ` / ${config.duration_ms} ms` : ''}</div>
      ))}
    </div>
  )
}
