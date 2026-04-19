import { useEffect, useMemo, useRef, useState } from 'react'
import { X, Play, Square, Scissors, RotateCcw, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { playStimulusBuffer } from '@/lib/audio/engine'
import { encodeWav, measureBuffer, detectVadBoundsMs } from '@/lib/audio/recording'
import { loadStimulusWav, saveStimulusWav, removeStimulusFile } from '@/lib/fs/stimuli'
import { updateStimulusRecording } from '@/lib/db/stimuli'
import type { Stimulus } from '@/types'

interface Props {
  stimulus: Stimulus
  onClose: () => void
  onSaved: () => void
}

function sliceBuffer(src: AudioBuffer, startFrame: number, endFrame: number): AudioBuffer {
  const len = Math.max(1, endFrame - startFrame)
  const ctx = new AudioContext({ sampleRate: src.sampleRate })
  const out = ctx.createBuffer(src.numberOfChannels, len, src.sampleRate)
  for (let ch = 0; ch < src.numberOfChannels; ch++) {
    const s = src.getChannelData(ch)
    const d = out.getChannelData(ch)
    for (let i = 0; i < len; i++) d[i] = s[startFrame + i] ?? 0
  }
  ctx.close().catch(() => {})
  return out
}

function drawWave(canvas: HTMLCanvasElement, data: Float32Array, startFrac: number, endFrac: number) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const { width: w, height: h } = canvas
  ctx.clearRect(0, 0, w, h)
  ctx.fillStyle = 'rgba(148,163,184,0.08)'
  ctx.fillRect(0, 0, w, h)

  const step = Math.max(1, Math.floor(data.length / w))
  ctx.strokeStyle = 'rgb(100,116,139)'
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let x = 0; x < w; x++) {
    let min = 1, max = -1
    const i0 = x * step
    const i1 = Math.min(data.length, i0 + step)
    for (let i = i0; i < i1; i++) {
      const v = data[i]
      if (v < min) min = v
      if (v > max) max = v
    }
    const y0 = (1 - (max + 1) / 2) * h
    const y1 = (1 - (min + 1) / 2) * h
    ctx.moveTo(x + 0.5, y0)
    ctx.lineTo(x + 0.5, y1)
  }
  ctx.stroke()

  // selection overlay
  const sx = Math.round(startFrac * w)
  const ex = Math.round(endFrac * w)
  ctx.fillStyle = 'rgba(59,130,246,0.18)'
  ctx.fillRect(sx, 0, Math.max(1, ex - sx), h)
  ctx.strokeStyle = 'rgb(59,130,246)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(sx + 0.5, 0); ctx.lineTo(sx + 0.5, h)
  ctx.moveTo(ex - 0.5, 0); ctx.lineTo(ex - 0.5, h)
  ctx.stroke()
}

export function StimulusEditDialog({ stimulus, onClose, onSaved }: Props) {
  const [buffer, setBuffer] = useState<AudioBuffer | null>(null)
  const [startMs, setStartMs] = useState(0)
  const [endMs, setEndMs] = useState(0)
  const [saving, setSaving] = useState(false)
  const [playing, setPlaying] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const stopRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      if (!stimulus.file_path) return
      const bytes = await loadStimulusWav(stimulus.file_path)
      const ctx = new AudioContext()
      const buf = await ctx.decodeAudioData(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer)
      await ctx.close()
      if (!alive) return
      const total = Math.round(buf.duration * 1000)
      setBuffer(buf)
      const auto = detectVadBoundsMs(buf)
      setStartMs(auto ? Math.max(0, auto.startMs) : 0)
      setEndMs(auto ? Math.min(total, auto.endMs) : total)
    })()
    return () => { alive = false; stopRef.current?.() }
  }, [stimulus.id, stimulus.file_path])

  const totalMs = buffer ? Math.round(buffer.duration * 1000) : 0
  const data = useMemo(() => buffer?.getChannelData(0) ?? null, [buffer])

  useEffect(() => {
    if (!canvasRef.current || !data || totalMs === 0) return
    drawWave(canvasRef.current, data, startMs / totalMs, endMs / totalMs)
  }, [data, startMs, endMs, totalMs])

  const previewSelection = async () => {
    if (!buffer) return
    if (playing) { stopRef.current?.(); stopRef.current = null; setPlaying(false); return }
    const sf = Math.floor((startMs / 1000) * buffer.sampleRate)
    const ef = Math.floor((endMs / 1000) * buffer.sampleRate)
    if (ef - sf < buffer.sampleRate * 0.02) return
    const slice = sliceBuffer(buffer, sf, ef)
    const stop = await playStimulusBuffer(slice, 60, {
      ear: 'binaural',
      rms_dbfs: stimulus.rms_dbfs,
      onEnd: () => { setPlaying(false); stopRef.current = null },
    })
    stopRef.current = stop
    setPlaying(true)
  }

  const reset = () => {
    setStartMs(0)
    setEndMs(totalMs)
  }

  const autoDetect = () => {
    if (!buffer) return
    const r = detectVadBoundsMs(buffer)
    if (!r) { alert('No se detectó voz. Ajustá los cursores manualmente.'); return }
    setStartMs(Math.max(0, r.startMs))
    setEndMs(Math.min(totalMs, r.endMs))
  }

  const applyTrim = async () => {
    if (!buffer || !stimulus.file_path) return
    if (endMs - startMs < 50) { alert('Selección demasiado corta (<50 ms).'); return }
    setSaving(true)
    try {
      const sf = Math.floor((startMs / 1000) * buffer.sampleRate)
      const ef = Math.floor((endMs / 1000) * buffer.sampleRate)
      const sliced = sliceBuffer(buffer, sf, ef)
      const wav = encodeWav(sliced)
      await removeStimulusFile(stimulus.file_path).catch(() => {})
      const absPath = await saveStimulusWav(stimulus.list_id, stimulus.position, stimulus.token, wav)
      const m = measureBuffer(sliced)
      await updateStimulusRecording(stimulus.id, {
        file_path: absPath,
        duration_ms: m.duration_ms,
        rms_dbfs: m.rms_dbfs,
        peak_dbfs: m.peak_dbfs,
        sample_rate: m.sample_rate,
        normalized: stimulus.normalized === 1,
      })
      onSaved()
      onClose()
    } catch (e) {
      alert('Error recortando: ' + (e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-[var(--card)] border border-[var(--border)] rounded-lg max-w-3xl w-full p-5 shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-lg font-bold">Editar audio — "{stimulus.token}"</h2>
            <p className="text-xs text-[var(--muted-foreground)]">Recortá marcando inicio y fin. El audio original se reemplaza al guardar.</p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-[var(--secondary)]">
            <X className="w-4 h-4" />
          </button>
        </div>

        {!buffer ? (
          <div className="py-12 text-center text-sm text-[var(--muted-foreground)]">Cargando…</div>
        ) : (
          <div className="space-y-4">
            <canvas
              ref={canvasRef}
              width={720}
              height={140}
              className="w-full h-[140px] rounded-md border border-[var(--border)] bg-[var(--secondary)]"
            />

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium">Inicio: {startMs} ms</label>
                <input
                  type="range"
                  min={0}
                  max={Math.max(0, endMs - 20)}
                  value={startMs}
                  onChange={e => setStartMs(Number(e.target.value))}
                  className="w-full"
                />
              </div>
              <div>
                <label className="text-xs font-medium">Fin: {endMs} ms</label>
                <input
                  type="range"
                  min={Math.min(totalMs, startMs + 20)}
                  max={totalMs}
                  value={endMs}
                  onChange={e => setEndMs(Number(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>

            <div className="text-xs text-[var(--muted-foreground)] flex justify-between">
              <span>Duración original: {totalMs} ms</span>
              <span>Selección: {endMs - startMs} ms</span>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <Button variant="ghost" size="sm" onClick={autoDetect} disabled={saving} title="Detectar voz automáticamente">
                <Wand2 className="w-4 h-4" /> Auto
              </Button>
              <Button variant="ghost" size="sm" onClick={reset} disabled={saving}>
                <RotateCcw className="w-4 h-4" /> Reset
              </Button>
              <Button variant="outline" size="sm" onClick={previewSelection} disabled={saving}>
                {playing ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {playing ? 'Detener' : 'Previsualizar'}
              </Button>
              <Button size="sm" onClick={applyTrim} disabled={saving || endMs - startMs < 50}>
                <Scissors className="w-4 h-4" /> {saving ? 'Guardando…' : 'Recortar y guardar'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
