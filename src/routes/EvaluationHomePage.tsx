import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Activity, Ear as EarIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { listPatients } from '@/lib/db/patients'
import { listTemplates } from '@/lib/db/templates'
import { createSession } from '@/lib/db/sessions'
import { useAuth } from '@/stores/auth'
import type { Patient, TestTemplateParsed, Ear, ResponseMode } from '@/types'

export function EvaluationHomePage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const profile = useAuth(s => s.activeProfile)

  const [patients, setPatients] = useState<Patient[]>([])
  const [templates, setTemplates] = useState<TestTemplateParsed[]>([])
  const [patientId, setPatientId] = useState<number | ''>('')
  const [templateId, setTemplateId] = useState<number | ''>('')
  const [ear, setEar] = useState<Ear>('binaural')
  const [responseMode, setResponseMode] = useState<ResponseMode>('manual')
  const [starting, setStarting] = useState(false)

  useEffect(() => {
    Promise.all([listPatients(), listTemplates(true)]).then(([p, t]) => {
      setPatients(p)
      setTemplates(t)
      const urlP = params.get('patient')
      if (urlP) setPatientId(Number(urlP))
    })
  }, [])

  const selectedTemplate = useMemo(
    () => templates.find(t => t.id === templateId) ?? null,
    [templates, templateId]
  )

  const start = async () => {
    if (!patientId || !templateId || !profile) return
    setStarting(true)
    try {
      const tmpl = templates.find(t => t.id === templateId)!
      const sid = await createSession({
        patient_id: Number(patientId),
        template_id: Number(templateId),
        profile_id: profile.id,
        ear,
        response_mode: responseMode,
        config_snapshot: JSON.stringify(tmpl.config),
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

      <Card className="mb-6">
        <CardHeader><CardTitle>Paciente y test</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Paciente</Label>
            <Select value={patientId} onChange={e => setPatientId(e.target.value ? Number(e.target.value) : '')}>
              <option value="">-- seleccionar --</option>
              {patients.map(p => (
                <option key={p.id} value={p.id}>{p.last_name}, {p.first_name}</option>
              ))}
            </Select>
            {patients.length === 0 && (
              <p className="text-sm text-[var(--muted-foreground)] mt-2">
                Sin pacientes. <a href="/pacientes" className="text-[var(--primary)]">Crear uno</a>
              </p>
            )}
          </div>
          <div>
            <Label>Test</Label>
            <Select value={templateId} onChange={e => setTemplateId(e.target.value ? Number(e.target.value) : '')}>
              <option value="">-- seleccionar --</option>
              {templates.map(t => (
                <option key={t.id} value={t.id}>{t.name} [{t.test_type}]</option>
              ))}
            </Select>
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
              <option value="manual">Manual (fonoaudiólogo marca)</option>
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

      <Button size="lg" className="w-full" disabled={!patientId || !templateId || starting} onClick={start}>
        <Activity className="w-5 h-5" /> {starting ? 'Iniciando...' : 'Iniciar evaluación'}
      </Button>
    </div>
  )
}

function TemplateSummary({ config }: { config: import('@/types').TestConfig }) {
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
