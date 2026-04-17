import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Play, Save, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { getTemplate, createTemplate, updateTemplate } from '@/lib/db/templates'
import { playTonePreview, playSequence, ensureRunning } from '@/lib/audio/engine'
import { useAuth } from '@/stores/auth'
import type { TestType, TestConfig } from '@/types'

const BLANK_CONFIG: TestConfig = {
  frequency: 1000,
  tones: {
    L: { label: 'Largo', duration_ms: 500 },
    C: { label: 'Corto', duration_ms: 250 },
  },
  isi_ms: 300,
  iri_ms: 6000,
  envelope_ms: 10,
  pattern_length: 3,
  practice_sequences: [],
  test_sequences: [],
  channel: 'binaural',
  level_db: 60,
}

export function TestEditorPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const profile = useAuth(s => s.activeProfile)
  const isNew = !id
  const tid = id ? Number(id) : null

  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [testType, setTestType] = useState<TestType>('DPS')
  const [description, setDescription] = useState('')
  const [isStandard, setIsStandard] = useState(false)
  const [config, setConfig] = useState<TestConfig>(BLANK_CONFIG)
  const [saving, setSaving] = useState(false)
  const [practiceText, setPracticeText] = useState('')
  const [testText, setTestText] = useState('')

  useEffect(() => {
    if (!tid) return
    getTemplate(tid).then(t => {
      if (!t) return
      setCode(t.code)
      setName(t.name)
      setTestType(t.test_type)
      setDescription(t.description ?? '')
      setIsStandard(!!t.is_standard)
      setConfig(t.config)
      setPracticeText(t.config.practice_sequences.join('\n'))
      setTestText(t.config.test_sequences.join('\n'))
    })
  }, [tid])

  const updateTone = (key: string, field: keyof TestConfig['tones'][string], value: string | number) => {
    setConfig({
      ...config,
      tones: { ...config.tones, [key]: { ...config.tones[key], [field]: value } },
    })
  }

  const renameTone = (oldKey: string, newKey: string) => {
    if (!newKey || newKey === oldKey || config.tones[newKey]) return
    const { [oldKey]: tone, ...rest } = config.tones
    setConfig({ ...config, tones: { ...rest, [newKey]: tone } })
  }

  const addTone = () => {
    const k = prompt('Clave del tono (1 letra, ej: M):')?.toUpperCase()
    if (!k || k.length !== 1 || config.tones[k]) return
    setConfig({ ...config, tones: { ...config.tones, [k]: { label: 'Nuevo', duration_ms: 300, frequency: 1000 } } })
  }

  const removeTone = (key: string) => {
    if (Object.keys(config.tones).length <= 2) { alert('Mínimo 2 tonos'); return }
    const { [key]: _removed, ...rest } = config.tones
    setConfig({ ...config, tones: rest })
  }

  const previewTone = async (key: string) => {
    await ensureRunning()
    const t = config.tones[key]
    const freq = t.frequency ?? config.frequency ?? 1000
    const dur = t.duration_ms ?? config.duration_ms ?? 400
    await playTonePreview(freq, dur, config.level_db)
  }

  const previewSequence = async (seq: string) => {
    await ensureRunning()
    await playSequence(seq, config)
  }

  const save = async () => {
    if (!name.trim() || !code.trim()) { alert('Nombre y código obligatorios'); return }
    setSaving(true)
    try {
      const fullConfig: TestConfig = {
        ...config,
        practice_sequences: practiceText.split(/\s+/).map(s => s.trim().toUpperCase()).filter(Boolean),
        test_sequences: testText.split(/\s+/).map(s => s.trim().toUpperCase()).filter(Boolean),
      }
      if (tid) {
        await updateTemplate(tid, { code, name, test_type: testType, description, config: fullConfig })
      } else {
        await createTemplate({ code, name, test_type: testType, description, config: fullConfig, created_by: profile?.id })
      }
      navigate('/tests')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <Link to="/tests" className="inline-flex items-center gap-2 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] mb-4">
        <ArrowLeft className="w-4 h-4" /> Volver
      </Link>
      <h1 className="text-3xl font-bold mb-6">{isNew ? 'Nuevo test' : isStandard ? 'Ver test estándar' : 'Editar test'}</h1>

      {isStandard && (
        <Card className="mb-4 border-[var(--primary)]">
          <CardContent className="p-4 text-sm">
            Este es un test estándar de referencia. Puedes verlo pero no modificarlo. Duplica para personalizar.
          </CardContent>
        </Card>
      )}

      <Card className="mb-4">
        <CardHeader><CardTitle>Información general</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div>
            <Label>Código *</Label>
            <Input value={code} onChange={e => setCode(e.target.value)} placeholder="DPS_CUSTOM_01" disabled={isStandard} />
          </div>
          <div>
            <Label>Tipo</Label>
            <Select value={testType} onChange={e => setTestType(e.target.value as TestType)} disabled={isStandard}>
              <option value="DPS">DPS</option>
              <option value="PPS">PPS</option>
              <option value="CUSTOM">CUSTOM</option>
            </Select>
          </div>
          <div className="col-span-2">
            <Label>Nombre *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} disabled={isStandard} />
          </div>
          <div className="col-span-2">
            <Label>Descripción</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} disabled={isStandard} />
          </div>
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardHeader><CardTitle>Tonos</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3 mb-3">
            {Object.entries(config.tones).map(([key, tone]) => (
              <div key={key} className="grid grid-cols-12 gap-2 items-end p-3 bg-[var(--secondary)] rounded-lg">
                <div className="col-span-1">
                  <Label>Clave</Label>
                  <Input value={key} onChange={e => renameTone(key, e.target.value.toUpperCase())} maxLength={1} disabled={isStandard} className="text-center font-bold" />
                </div>
                <div className="col-span-3">
                  <Label>Etiqueta</Label>
                  <Input value={tone.label} onChange={e => updateTone(key, 'label', e.target.value)} disabled={isStandard} />
                </div>
                <div className="col-span-3">
                  <Label>Frecuencia (Hz)</Label>
                  <Input type="number" value={tone.frequency ?? ''} placeholder={String(config.frequency ?? '')} onChange={e => updateTone(key, 'frequency', Number(e.target.value))} disabled={isStandard} />
                </div>
                <div className="col-span-3">
                  <Label>Duración (ms)</Label>
                  <Input type="number" value={tone.duration_ms ?? ''} placeholder={String(config.duration_ms ?? '')} onChange={e => updateTone(key, 'duration_ms', Number(e.target.value))} disabled={isStandard} />
                </div>
                <div className="col-span-2 flex gap-1">
                  <Button size="sm" variant="outline" type="button" onClick={() => previewTone(key)}>
                    <Play className="w-3 h-3" />
                  </Button>
                  {!isStandard && (
                    <Button size="sm" variant="destructive" type="button" onClick={() => removeTone(key)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
          {!isStandard && (
            <Button variant="outline" size="sm" onClick={addTone}>+ Agregar tono</Button>
          )}
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardHeader><CardTitle>Timing</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-3 gap-4">
          <div>
            <Label>Frecuencia default (Hz)</Label>
            <Input type="number" value={config.frequency ?? ''} onChange={e => setConfig({ ...config, frequency: Number(e.target.value) })} disabled={isStandard} />
          </div>
          <div>
            <Label>Duración default (ms)</Label>
            <Input type="number" value={config.duration_ms ?? ''} onChange={e => setConfig({ ...config, duration_ms: Number(e.target.value) })} disabled={isStandard} />
          </div>
          <div>
            <Label>Longitud patrón</Label>
            <Input type="number" value={config.pattern_length} onChange={e => setConfig({ ...config, pattern_length: Number(e.target.value) })} disabled={isStandard} />
          </div>
          <div>
            <Label>ISI (ms) - entre tonos</Label>
            <Input type="number" value={config.isi_ms} onChange={e => setConfig({ ...config, isi_ms: Number(e.target.value) })} disabled={isStandard} />
          </div>
          <div>
            <Label>IRI (ms) - entre ítems</Label>
            <Input type="number" value={config.iri_ms} onChange={e => setConfig({ ...config, iri_ms: Number(e.target.value) })} disabled={isStandard} />
          </div>
          <div>
            <Label>Envelope (ms) - fade</Label>
            <Input type="number" value={config.envelope_ms} onChange={e => setConfig({ ...config, envelope_ms: Number(e.target.value) })} disabled={isStandard} />
          </div>
          <div>
            <Label>Canal default</Label>
            <Select value={config.channel} onChange={e => setConfig({ ...config, channel: e.target.value as any })} disabled={isStandard}>
              <option value="binaural">Binaural</option>
              <option value="left">Izquierdo</option>
              <option value="right">Derecho</option>
            </Select>
          </div>
          <div>
            <Label>Nivel (dB SPL aprox)</Label>
            <Input type="number" value={config.level_db} onChange={e => setConfig({ ...config, level_db: Number(e.target.value) })} disabled={isStandard} />
          </div>
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardHeader><CardTitle>Secuencias de práctica</CardTitle></CardHeader>
        <CardContent>
          <Textarea value={practiceText} onChange={e => setPracticeText(e.target.value)} rows={6} placeholder="Una secuencia por línea, ej: LCC" disabled={isStandard} className="font-mono" />
          <p className="text-xs text-[var(--muted-foreground)] mt-2">
            {practiceText.split(/\s+/).filter(Boolean).length} secuencias
          </p>
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardHeader><CardTitle>Secuencias del test</CardTitle></CardHeader>
        <CardContent>
          <Textarea value={testText} onChange={e => setTestText(e.target.value)} rows={10} placeholder="Una secuencia por línea" disabled={isStandard} className="font-mono" />
          <p className="text-xs text-[var(--muted-foreground)] mt-2">
            {testText.split(/\s+/).filter(Boolean).length} secuencias
          </p>
          {testText.split(/\s+/).filter(Boolean)[0] && (
            <Button variant="outline" size="sm" className="mt-2" onClick={() => previewSequence(testText.split(/\s+/).filter(Boolean)[0])}>
              <Play className="w-3 h-3" /> Previsualizar primera
            </Button>
          )}
        </CardContent>
      </Card>

      {!isStandard && (
        <Button size="lg" className="w-full" onClick={save} disabled={saving}>
          <Save className="w-5 h-5" /> {saving ? 'Guardando...' : 'Guardar test'}
        </Button>
      )}
    </div>
  )
}
