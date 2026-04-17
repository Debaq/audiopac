import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Play, Square, Check, Trash2, RefreshCw, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { playCalibrationTone, ensureRunning } from '@/lib/audio/engine'
import {
  createCalibration, listCalibrations, setActiveCalibration, deleteCalibration, getActiveCalibration,
  isCalibrationExpired, upsertPoint, listPoints, deletePoint,
} from '@/lib/db/calibrations'
import { listAudioOutputs, requestDeviceLabelPermission, type AudioOutputDevice } from '@/lib/audio/device'
import { useCalibrationStore } from '@/stores/calibration'
import { useAuth } from '@/stores/auth'
import type { Calibration, CalibrationPoint, Ear } from '@/types'
import { formatDateTime } from '@/lib/utils'

const DEFAULT_DBFS = -20
const STD_FREQS = [250, 500, 1000, 2000, 4000, 8000]
const EARS: Ear[] = ['left', 'right']

export function CalibrationPage() {
  const profile = useAuth(s => s.activeProfile)
  const refreshStore = useCalibrationStore(s => s.refresh)

  const [list, setList] = useState<Calibration[]>([])
  const [pointsByCal, setPointsByCal] = useState<Record<number, CalibrationPoint[]>>({})
  const [devices, setDevices] = useState<AudioOutputDevice[]>([])
  const [deviceId, setDeviceId] = useState<string>('')
  const [needsPermission, setNeedsPermission] = useState(false)

  const [newLabel, setNewLabel] = useState('')
  const [newHeadphone, setNewHeadphone] = useState('')
  const [newNotes, setNewNotes] = useState('')

  const [selFreq, setSelFreq] = useState<number>(1000)
  const [selEar, setSelEar] = useState<Ear>('left')
  const [dbfs, setDbfs] = useState<number>(DEFAULT_DBFS)
  const [measured, setMeasured] = useState<string>('')
  const [isPlaying, setIsPlaying] = useState(false)
  const stopRef = useRef<(() => void) | null>(null)

  const activeCal = useMemo(() => list.find(c => c.is_active === 1) ?? null, [list])
  const activePoints = activeCal ? (pointsByCal[activeCal.id] ?? []) : []

  const refreshAll = async () => {
    const cals = await listCalibrations()
    setList(cals)
    const pointsMap: Record<number, CalibrationPoint[]> = {}
    await Promise.all(cals.map(async c => { pointsMap[c.id] = await listPoints(c.id) }))
    setPointsByCal(pointsMap)
    refreshStore()
  }

  const refreshDevices = async () => {
    const outs = await listAudioOutputs()
    setDevices(outs)
    setNeedsPermission(outs.length > 0 && outs.every(d => !d.label || d.label.startsWith('(sin etiqueta')))
    if (!deviceId && outs.length > 0) {
      setDeviceId(outs.find(d => d.deviceId === 'default')?.deviceId ?? outs[0].deviceId)
    }
  }

  useEffect(() => {
    refreshAll()
    refreshDevices()
    const h = () => refreshDevices()
    navigator.mediaDevices?.addEventListener?.('devicechange', h)
    return () => {
      stopRef.current?.()
      navigator.mediaDevices?.removeEventListener?.('devicechange', h)
    }
  }, [])

  const grantPermission = async () => {
    await requestDeviceLabelPermission()
    await refreshDevices()
  }

  const togglePlay = async () => {
    if (isPlaying) {
      stopRef.current?.()
      stopRef.current = null
      setIsPlaying(false)
      return
    }
    await ensureRunning()
    const stop = await playCalibrationTone(selFreq, dbfs, selEar)
    stopRef.current = stop
    setIsPlaying(true)
  }

  const createNew = async () => {
    if (!newLabel.trim()) { alert('Nombre requerido'); return }
    const dev = devices.find(d => d.deviceId === deviceId) ?? null
    await createCalibration({
      label: newLabel.trim(),
      device_id: dev?.deviceId ?? null,
      device_label: dev?.label ?? null,
      headphone_model: newHeadphone.trim() || null,
      ear: 'binaural',
      frequency_hz: 1000,
      internal_level_dbfs: DEFAULT_DBFS,
      measured_db_spl: 0,
      ref_db_spl: 85,
      notes: newNotes.trim() || null,
      created_by: profile?.id ?? null,
      activate: true,
    })
    setNewLabel(''); setNewHeadphone(''); setNewNotes('')
    refreshAll()
  }

  const savePoint = async () => {
    if (!activeCal) { alert('Creá o activá una calibración primero'); return }
    const m = Number(measured)
    if (!Number.isFinite(m)) { alert('Ingresá el dB SPL medido'); return }
    const refDb = m - dbfs
    await upsertPoint({
      calibration_id: activeCal.id,
      frequency_hz: selFreq,
      ear: selEar,
      internal_level_dbfs: dbfs,
      measured_db_spl: m,
      ref_db_spl: refDb,
    })
    setMeasured('')
    refreshAll()
  }

  const removePoint = async (id: number) => {
    await deletePoint(id)
    refreshAll()
  }

  const activate = async (id: number) => {
    await setActiveCalibration(id)
    refreshAll()
  }

  const remove = async (id: number) => {
    if (!confirm('¿Eliminar esta calibración y todos sus puntos?')) return
    await deleteCalibration(id)
    refreshAll()
  }

  const preview = Number(measured) - dbfs
  const previewOk = Number.isFinite(Number(measured))

  const pointFor = (f: number, e: Ear) => activePoints.find(p => p.frequency_hz === f && p.ear === e)

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Calibración con sonómetro</h1>
        <p className="text-[var(--muted-foreground)]">Curva multi-frecuencia por oído (250–8000 Hz).</p>
      </div>

      <Card className="mb-4 border-[var(--border)]/60 bg-amber-500/5">
        <CardContent className="pt-5 flex gap-3 items-start">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="text-sm space-y-1">
            <p><strong>Uso investigativo / screening.</strong> No cumple ANSI S3.6 / IEC 60645-1 sin acoplador.</p>
            <p>Válida sólo para <strong>este par de auriculares + dispositivo + volumen de SO fijo</strong>. Si cambia algo, recalibrar.</p>
            <p>Curva completa: 6 frecuencias × 2 oídos = 12 puntos. Se interpola en log-frecuencia entre puntos.</p>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>1. Dispositivo de salida</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Select value={deviceId} onChange={e => setDeviceId(e.target.value)} className="flex-1">
              {devices.length === 0 && <option value="">(sin dispositivos)</option>}
              {devices.map(d => (
                <option key={d.deviceId} value={d.deviceId}>{d.label}</option>
              ))}
            </Select>
            <Button variant="outline" size="sm" onClick={refreshDevices} title="Refrescar">
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
          {needsPermission && (
            <p className="text-xs text-amber-600 mt-1.5 flex gap-2 items-center">
              Los nombres de dispositivos están ocultos.
              <button className="underline" onClick={grantPermission}>Conceder permiso</button>
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>2. Crear nueva calibración</CardTitle>
          <CardDescription>Un "set" contiene la curva completa. Creá y después agregá puntos.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div>
            <Label>Nombre *</Label>
            <Input value={newLabel} placeholder="Auriculares estudio XYZ" onChange={e => setNewLabel(e.target.value)} />
          </div>
          <div>
            <Label>Modelo de auriculares</Label>
            <Input value={newHeadphone} onChange={e => setNewHeadphone(e.target.value)} placeholder="Opcional" />
          </div>
          <div className="col-span-2">
            <Label>Notas</Label>
            <Textarea rows={2} value={newNotes} onChange={e => setNewNotes(e.target.value)} />
          </div>
          <div className="col-span-2">
            <Button onClick={createNew} disabled={!newLabel.trim()}>
              <Plus className="w-4 h-4 mr-1.5" />Crear y activar
            </Button>
          </div>
        </CardContent>
      </Card>

      {activeCal && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>3. Agregar/editar puntos — {activeCal.label}</CardTitle>
            <CardDescription>
              Seleccioná freq + oído, reproducí el tono, medí con sonómetro, guardá. Repetí 6 × 2 = 12 puntos.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Frecuencia</Label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {STD_FREQS.map(f => (
                  <Button
                    key={f}
                    size="sm"
                    variant={selFreq === f ? 'default' : 'outline'}
                    onClick={() => setSelFreq(f)}
                  >
                    {f} Hz
                  </Button>
                ))}
                <Input
                  type="number"
                  value={selFreq}
                  onChange={e => setSelFreq(Number(e.target.value))}
                  className="w-24"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Oído</Label>
                <Select value={selEar} onChange={e => setSelEar(e.target.value as Ear)}>
                  <option value="left">Izquierdo</option>
                  <option value="right">Derecho</option>
                  <option value="binaural">Binaural</option>
                </Select>
              </div>
              <div>
                <Label>Nivel interno (dBFS)</Label>
                <Input type="number" step="1" value={dbfs} onChange={e => setDbfs(Number(e.target.value))} />
              </div>
              <div>
                <Label>dB SPL medido</Label>
                <Input type="number" step="0.1" value={measured} placeholder="ej. 74" onChange={e => setMeasured(e.target.value)} />
              </div>
            </div>

            <div className="flex gap-2 items-center">
              <Button onClick={togglePlay} variant={isPlaying ? 'destructive' : 'default'}>
                {isPlaying ? <><Square className="w-4 h-4 mr-1.5" />Detener</> : <><Play className="w-4 h-4 mr-1.5" />Reproducir</>}
              </Button>
              <Button onClick={savePoint} disabled={!previewOk} variant="secondary">
                <Check className="w-4 h-4 mr-1.5" />Guardar punto
              </Button>
              {previewOk && (
                <span className="text-xs text-[var(--muted-foreground)]">
                  → Ref <strong>{preview.toFixed(1)} dB SPL @ 0 dBFS</strong>
                </span>
              )}
            </div>

            <div className="pt-2">
              <Label>Matriz de puntos</Label>
              <table className="w-full text-xs mt-2 border-collapse">
                <thead>
                  <tr>
                    <th className="text-left p-1.5 border-b border-[var(--border)]">Oído</th>
                    {STD_FREQS.map(f => (
                      <th key={f} className="p-1.5 border-b border-[var(--border)] text-center">{f}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {EARS.map(e => (
                    <tr key={e}>
                      <td className="p-1.5 border-b border-[var(--border)]/40 font-medium">
                        {e === 'left' ? 'Izquierdo' : 'Derecho'}
                      </td>
                      {STD_FREQS.map(f => {
                        const pt = pointFor(f, e)
                        const isSel = selFreq === f && selEar === e
                        return (
                          <td
                            key={f}
                            className={`p-1.5 border-b border-[var(--border)]/40 text-center cursor-pointer ${isSel ? 'bg-[var(--primary)]/10' : ''} ${pt ? 'text-emerald-600 font-semibold' : 'text-[var(--muted-foreground)]'}`}
                            onClick={() => { setSelFreq(f); setSelEar(e) }}
                            title={pt ? `Ref ${pt.ref_db_spl.toFixed(1)} dB SPL` : 'Sin medir'}
                          >
                            {pt ? pt.ref_db_spl.toFixed(0) : '—'}
                            {pt && (
                              <button
                                className="ml-1 text-red-500 hover:underline"
                                onClick={ev => { ev.stopPropagation(); removePoint(pt.id) }}
                              >
                                ×
                              </button>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-xs text-[var(--muted-foreground)] mt-2">
                {activePoints.length} / 12 puntos. Frecuencias no medidas se interpolan log-freq desde las más cercanas.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Calibraciones guardadas</CardTitle></CardHeader>
        <CardContent>
          {list.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)]">Ninguna. Motor usa ref 85 dB SPL @ 0 dBFS por defecto.</p>
          ) : (
            <div className="space-y-2">
              {list.map(c => {
                const expired = isCalibrationExpired(c)
                const pts = pointsByCal[c.id] ?? []
                return (
                  <div key={c.id} className={`p-3 rounded-lg ${expired ? 'bg-red-500/10' : 'bg-[var(--secondary)]'}`}>
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{c.label}</span>
                          {c.is_active === 1 && <Badge>Activa</Badge>}
                          {expired && <Badge className="bg-red-500">Vencida</Badge>}
                          <Badge className="bg-slate-500">{pts.length} puntos</Badge>
                        </div>
                        <div className="text-xs text-[var(--muted-foreground)]">
                          {c.headphone_model ?? '—'} · {formatDateTime(c.created_at)}
                          {c.device_label && <> · <span title={c.device_id ?? ''}>{c.device_label}</span></>}
                          {c.valid_until && <> · vence {formatDateTime(c.valid_until)}</>}
                        </div>
                      </div>
                      {c.is_active !== 1 && (
                        <Button size="sm" variant="outline" onClick={() => activate(c.id)}>Activar</Button>
                      )}
                      <Button size="sm" variant="destructive" onClick={() => remove(c.id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
