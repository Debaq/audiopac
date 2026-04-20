import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Play, Save, Trash2, LayoutGrid, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { SequenceBuilder } from '@/components/SequenceBuilder'
import { SRTConfigEditor, BLANK_SRT } from '@/components/editors/SRTConfigEditor'
import { DichoticConfigEditor, BLANK_DICHOTIC } from '@/components/editors/DichoticConfigEditor'
import { HINTConfigEditor, BLANK_HINT } from '@/components/editors/HINTConfigEditor'
import { MatrixConfigEditor, BLANK_MATRIX } from '@/components/editors/MatrixConfigEditor'
import { SSWConfigEditor, BLANK_SSW } from '@/components/editors/SSWConfigEditor'
import { SharedConfigSection } from '@/components/editors/SharedConfigSection'
import { AdvancedJsonEditor } from '@/components/editors/AdvancedJsonEditor'
import { getTemplate, createTemplate, updateTemplate } from '@/lib/db/templates'
import { playTonePreview, playSequence, ensureRunning } from '@/lib/audio/engine'
import { useAuth } from '@/stores/auth'
import { cn } from '@/lib/utils'
import type { TestType, TestConfig, SRTParams, DichoticDigitsParams, HINTParams, MatrixParams, SSWParams } from '@/types'

type EngineKey = 'patterns' | 'srt' | 'dichotic' | 'hint' | 'matrix' | 'ssw'

function detectEngine(cfg: TestConfig): EngineKey {
  if (cfg.srt) return 'srt'
  if (cfg.dichotic_digits) return 'dichotic'
  if (cfg.hint) return 'hint'
  if (cfg.matrix) return 'matrix'
  if (cfg.ssw) return 'ssw'
  return 'patterns'
}

const BLANK_PATTERNS_CONFIG: TestConfig = {
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

const BLANK_SRT_CONFIG: TestConfig = {
  tones: {},
  isi_ms: 0,
  iri_ms: 0,
  envelope_ms: 0,
  pattern_length: 0,
  practice_sequences: [],
  test_sequences: [],
  channel: 'binaural',
  level_db: 50,
  srt: BLANK_SRT,
}

const BLANK_DICHOTIC_CONFIG: TestConfig = {
  tones: {},
  isi_ms: 0,
  iri_ms: 0,
  envelope_ms: 0,
  pattern_length: 0,
  practice_sequences: [],
  test_sequences: [],
  channel: 'binaural',
  level_db: 55,
  dichotic_digits: BLANK_DICHOTIC,
}

const BLANK_HINT_CONFIG: TestConfig = {
  tones: {},
  isi_ms: 0,
  iri_ms: 0,
  envelope_ms: 0,
  pattern_length: 0,
  practice_sequences: [],
  test_sequences: [],
  channel: 'binaural',
  level_db: 65,
  hint: BLANK_HINT,
}

const BLANK_MATRIX_CONFIG: TestConfig = {
  tones: {},
  isi_ms: 0,
  iri_ms: 0,
  envelope_ms: 0,
  pattern_length: 0,
  practice_sequences: [],
  test_sequences: [],
  channel: 'binaural',
  level_db: 65,
  matrix: BLANK_MATRIX,
}

const BLANK_SSW_CONFIG: TestConfig = {
  tones: {},
  isi_ms: 0,
  iri_ms: 2000,
  envelope_ms: 0,
  pattern_length: 0,
  practice_sequences: [],
  test_sequences: [],
  channel: 'binaural',
  level_db: 50,
  ssw: BLANK_SSW,
}

function blankForEngine(engine: EngineKey): TestConfig {
  if (engine === 'srt') return BLANK_SRT_CONFIG
  if (engine === 'dichotic') return BLANK_DICHOTIC_CONFIG
  if (engine === 'hint') return BLANK_HINT_CONFIG
  if (engine === 'matrix') return BLANK_MATRIX_CONFIG
  if (engine === 'ssw') return BLANK_SSW_CONFIG
  return BLANK_PATTERNS_CONFIG
}

export function TestEditorPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const profile = useAuth(s => s.activeProfile)
  const isNew = !id
  const tid = id ? Number(id) : null
  const familyFromUrl = searchParams.get('family')
  const engineFromUrl = (searchParams.get('engine') as EngineKey | null) ?? 'patterns'

  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [testType, setTestType] = useState<TestType>(engineFromUrl === 'patterns' ? 'DPS' : 'CUSTOM')
  const [description, setDescription] = useState('')
  const [isStandard, setIsStandard] = useState(false)
  const [config, setConfig] = useState<TestConfig>(() => {
    const base = blankForEngine(engineFromUrl)
    return familyFromUrl ? { ...base, family: familyFromUrl } : base
  })
  const engine: EngineKey = detectEngine(config)
  const [saving, setSaving] = useState(false)
  const [practiceText, setPracticeText] = useState('')
  const [testText, setTestText] = useState('')
  const [mode, setMode] = useState<'visual' | 'texto'>('visual')
  const [practiceSeqs, setPracticeSeqs] = useState<string[]>([])
  const [testSeqs, setTestSeqs] = useState<string[]>([])

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
      setPracticeSeqs(t.config.practice_sequences)
      setTestSeqs(t.config.test_sequences)
    })
  }, [tid])

  const parsedPractice = useMemo(
    () => practiceText.split(/\s+/).map(s => s.trim().toUpperCase()).filter(Boolean),
    [practiceText]
  )
  const parsedTest = useMemo(
    () => testText.split(/\s+/).map(s => s.trim().toUpperCase()).filter(Boolean),
    [testText]
  )

  const syncTextToVisual = () => {
    setPracticeSeqs(parsedPractice)
    setTestSeqs(parsedTest)
  }

  const syncVisualToText = () => {
    setPracticeText(practiceSeqs.join('\n'))
    setTestText(testSeqs.join('\n'))
  }

  const updateTone = (key: string, field: keyof TestConfig['tones'][string], value: string | number | undefined) => {
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
    await playTonePreview(freq, dur, t.level_db ?? config.level_db, {
      ear: t.ear ?? config.channel,
      gain_l: t.gain_l,
      gain_r: t.gain_r,
    })
  }

  const previewSequence = async (seq: string) => {
    await ensureRunning()
    await playSequence(seq, config)
  }

  const goToRecord = async (listCode: string) => {
    const returnTo = tid ? `/tests/${tid}` : `/tests`
    const target = `/estimulos?list=${encodeURIComponent(listCode)}&returnTo=${encodeURIComponent(returnTo)}`
    if (!tid && (!name.trim() || !code.trim())) {
      alert('Guarda el test primero (completa nombre y código).')
      return
    }
    await save({ redirectTo: target })
  }

  const save = async (opts?: { redirectTo?: string }) => {
    if (!name.trim() || !code.trim()) { alert('Nombre y código obligatorios'); return }
    if (engine === 'srt' && !config.srt?.stimulus_list_code) {
      alert('SRT requiere elegir una lista de estímulos.')
      return
    }
    if (engine === 'dichotic' && !config.dichotic_digits?.stimulus_list_code) {
      alert('Dichotic Digits requiere elegir una lista de estímulos.')
      return
    }
    if (engine === 'hint' && !config.hint?.stimulus_list_code) {
      alert('HINT / SinB requiere elegir una lista de frases.')
      return
    }
    if (engine === 'matrix' && !config.matrix?.stimulus_list_code) {
      alert('Matrix requiere elegir una lista con asignación de columnas.')
      return
    }
    if (engine === 'ssw' && !config.ssw?.stimulus_list_code) {
      alert('SSW requiere elegir una lista con 160 hemispondees.')
      return
    }
    setSaving(true)
    try {
      const practice = mode === 'visual' ? practiceSeqs : parsedPractice
      const test = mode === 'visual' ? testSeqs : parsedTest
      const fullConfig: TestConfig = engine === 'patterns'
        ? { ...config, practice_sequences: practice, test_sequences: test }
        : config
      let targetId: number | null = tid
      if (tid) {
        await updateTemplate(tid, { code, name, test_type: testType, description, config: fullConfig })
      } else {
        targetId = await createTemplate({ code, name, test_type: testType, description, config: fullConfig, created_by: profile?.id })
      }
      navigate(opts?.redirectTo ?? '/tests', { state: { savedId: targetId } })
    } finally {
      setSaving(false)
    }
  }

  const wideLayout = engine !== 'patterns'

  return (
    <div className={`p-8 ${wideLayout ? 'max-w-[1400px]' : 'max-w-4xl'} mx-auto`}>
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
            {engine === 'patterns' ? (
              <Select value={testType} onChange={e => setTestType(e.target.value as TestType)} disabled={isStandard}>
                <option value="DPS">DPS</option>
                <option value="PPS">PPS</option>
                <option value="CUSTOM">CUSTOM</option>
              </Select>
            ) : (
              <Input value={`Motor: ${engine.toUpperCase()}`} disabled readOnly />
            )}
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

      {engine === 'srt' && config.srt && (
        <>
          <SRTConfigEditor
            value={config.srt}
            onChange={(srt: SRTParams) => setConfig({ ...config, srt })}
            disabled={isStandard}
            onGoToRecord={goToRecord}
          />
          <div className="mb-4">
            <SharedConfigSection value={config} onChange={setConfig} disabled={isStandard} />
          </div>
          <div className="mb-4">
            <AdvancedJsonEditor value={config} onChange={setConfig} disabled={isStandard} />
          </div>
        </>
      )}

      {engine === 'dichotic' && config.dichotic_digits && (
        <>
          <DichoticConfigEditor
            value={config.dichotic_digits}
            onChange={(dichotic_digits: DichoticDigitsParams) => setConfig({ ...config, dichotic_digits })}
            disabled={isStandard}
            onGoToRecord={goToRecord}
          />
          <div className="mb-4">
            <SharedConfigSection value={config} onChange={setConfig} disabled={isStandard} />
          </div>
          <div className="mb-4">
            <AdvancedJsonEditor value={config} onChange={setConfig} disabled={isStandard} />
          </div>
        </>
      )}

      {engine === 'hint' && config.hint && (
        <>
          <HINTConfigEditor
            value={config.hint}
            onChange={(hint: HINTParams) => setConfig({ ...config, hint })}
            disabled={isStandard}
            onGoToRecord={goToRecord}
          />
          <div className="mb-4">
            <SharedConfigSection value={config} onChange={setConfig} disabled={isStandard} />
          </div>
          <div className="mb-4">
            <AdvancedJsonEditor value={config} onChange={setConfig} disabled={isStandard} />
          </div>
        </>
      )}

      {engine === 'matrix' && config.matrix && (
        <>
          <MatrixConfigEditor
            value={config.matrix}
            onChange={(matrix: MatrixParams) => setConfig({ ...config, matrix })}
            disabled={isStandard}
            onGoToRecord={goToRecord}
          />
          <div className="mb-4">
            <SharedConfigSection value={config} onChange={setConfig} disabled={isStandard} />
          </div>
          <div className="mb-4">
            <AdvancedJsonEditor value={config} onChange={setConfig} disabled={isStandard} />
          </div>
        </>
      )}

      {engine === 'ssw' && config.ssw && (
        <>
          <SSWConfigEditor
            value={config.ssw}
            onChange={(ssw: SSWParams) => setConfig({ ...config, ssw })}
            disabled={isStandard}
            onGoToRecord={goToRecord}
          />
          <div className="mb-4">
            <SharedConfigSection value={config} onChange={setConfig} disabled={isStandard} />
          </div>
          <div className="mb-4">
            <AdvancedJsonEditor value={config} onChange={setConfig} disabled={isStandard} />
          </div>
        </>
      )}

      {engine === 'patterns' && (<>
      <Card className="mb-4">
        <CardHeader><CardTitle>Tonos</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3 mb-3">
            {Object.entries(config.tones).map(([key, tone]) => (
              <div key={key} className="p-3 bg-[var(--secondary)] rounded-lg space-y-2">
                <div className="grid grid-cols-12 gap-2 items-end">
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
                <div className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-3">
                    <Label className="text-[10px]">Nivel dB (override)</Label>
                    <Input type="number" value={tone.level_db ?? ''} placeholder={String(config.level_db)} onChange={e => updateTone(key, 'level_db', e.target.value === '' ? undefined : Number(e.target.value))} disabled={isStandard} />
                  </div>
                  <div className="col-span-3">
                    <Label className="text-[10px]">Oído (override)</Label>
                    <Select value={tone.ear ?? ''} onChange={e => updateTone(key, 'ear', e.target.value === '' ? undefined : e.target.value)} disabled={isStandard}>
                      <option value="">(sesión)</option>
                      <option value="left">Izquierdo</option>
                      <option value="right">Derecho</option>
                      <option value="binaural">Binaural</option>
                    </Select>
                  </div>
                  <div className="col-span-3">
                    <Label className="text-[10px]">Gain L (0-1)</Label>
                    <Input type="number" step="0.1" min="0" max="1" value={tone.gain_l ?? ''} placeholder="—" onChange={e => updateTone(key, 'gain_l', e.target.value === '' ? undefined : Number(e.target.value))} disabled={isStandard} />
                  </div>
                  <div className="col-span-3">
                    <Label className="text-[10px]">Gain R (0-1)</Label>
                    <Input type="number" step="0.1" min="0" max="1" value={tone.gain_r ?? ''} placeholder="—" onChange={e => updateTone(key, 'gain_r', e.target.value === '' ? undefined : Number(e.target.value))} disabled={isStandard} />
                  </div>
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
            <Label>Longitud por defecto</Label>
            <Input type="number" min={1} value={config.pattern_length} onChange={e => setConfig({ ...config, pattern_length: Math.max(1, Number(e.target.value)) })} disabled={isStandard} />
            <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5">Sólo al crear nuevas. Cada secuencia puede tener longitud distinta.</p>
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

      <div className="flex items-center justify-between mb-3 px-1">
        <h2 className="text-lg font-bold">Secuencias</h2>
        <div className="flex gap-1 p-1 bg-[var(--secondary)] rounded-lg">
          <button
            onClick={() => { if (mode === 'texto') syncTextToVisual(); setMode('visual') }}
            className={cn(
              'px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 transition-colors',
              mode === 'visual' ? 'bg-[var(--card)] text-[var(--foreground)] shadow-sm' : 'text-[var(--muted-foreground)]'
            )}
          >
            <LayoutGrid className="w-4 h-4" /> Visual
          </button>
          <button
            onClick={() => { if (mode === 'visual') syncVisualToText(); setMode('texto') }}
            className={cn(
              'px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 transition-colors',
              mode === 'texto' ? 'bg-[var(--card)] text-[var(--foreground)] shadow-sm' : 'text-[var(--muted-foreground)]'
            )}
          >
            <FileText className="w-4 h-4" /> Texto
          </button>
        </div>
      </div>

      {mode === 'visual' ? (
        <>
          <Card className="mb-4">
            <CardHeader><CardTitle className="flex items-center justify-between">
              <span>Secuencias de práctica</span>
              <span className="text-sm font-normal text-[var(--muted-foreground)]">{practiceSeqs.length}</span>
            </CardTitle></CardHeader>
            <CardContent>
              <SequenceBuilder
                sequences={practiceSeqs}
                onChange={setPracticeSeqs}
                config={config}
                patternLength={config.pattern_length}
                readOnly={isStandard}
              />
            </CardContent>
          </Card>

          <Card className="mb-4">
            <CardHeader><CardTitle className="flex items-center justify-between">
              <span>Secuencias del test</span>
              <span className="text-sm font-normal text-[var(--muted-foreground)]">{testSeqs.length}</span>
            </CardTitle></CardHeader>
            <CardContent>
              <SequenceBuilder
                sequences={testSeqs}
                onChange={setTestSeqs}
                config={config}
                patternLength={config.pattern_length}
                readOnly={isStandard}
              />
            </CardContent>
          </Card>
        </>
      ) : (
        <>
          <Card className="mb-4">
            <CardHeader><CardTitle>Secuencias de práctica</CardTitle></CardHeader>
            <CardContent>
              <Textarea value={practiceText} onChange={e => setPracticeText(e.target.value)} rows={6} placeholder="Una secuencia por línea, ej: LCC" disabled={isStandard} className="font-mono" />
              <p className="text-xs text-[var(--muted-foreground)] mt-2">{parsedPractice.length} secuencias</p>
            </CardContent>
          </Card>

          <Card className="mb-4">
            <CardHeader><CardTitle>Secuencias del test</CardTitle></CardHeader>
            <CardContent>
              <Textarea value={testText} onChange={e => setTestText(e.target.value)} rows={10} placeholder="Una secuencia por línea" disabled={isStandard} className="font-mono" />
              <p className="text-xs text-[var(--muted-foreground)] mt-2">{parsedTest.length} secuencias</p>
              {parsedTest[0] && (
                <Button variant="outline" size="sm" className="mt-2" onClick={() => previewSequence(parsedTest[0])}>
                  <Play className="w-3 h-3" /> Previsualizar primera
                </Button>
              )}
            </CardContent>
          </Card>
        </>
      )}
      </>)}

      {!isStandard && (
        <Button size="lg" className="w-full" onClick={() => save()} disabled={saving}>
          <Save className="w-5 h-5" /> {saving ? 'Guardando...' : 'Guardar test'}
        </Button>
      )}
    </div>
  )
}
