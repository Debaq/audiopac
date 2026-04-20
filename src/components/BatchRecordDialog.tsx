import { useEffect, useRef, useState } from 'react'
import { X, Mic, Square, Play, Check, ChevronRight, AlertTriangle, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  startMicRecording, processClip, encodeWav, DEFAULT_PROC,
  detectVadSegmentsMs, type VadRangeMs, type RecordedClip,
} from '@/lib/audio/recording'
import { playStimulusBuffer } from '@/lib/audio/engine'
import { saveStimulusWav, removeStimulusFile } from '@/lib/fs/stimuli'
import { updateStimulusRecording } from '@/lib/db/stimuli'
import type { Stimulus } from '@/types'

interface Props {
  items: Stimulus[]
  onClose: () => void
  onSaved: () => void
}

type Phase = 'idle' | 'recording' | 'review' | 'saving'

interface SegRow {
  stimulus: Stimulus
  range: VadRangeMs | null
  keep: boolean
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

function drawWaveWithSegs(
  canvas: HTMLCanvasElement, data: Float32Array, totalMs: number,
  rows: SegRow[], currentIdx: number,
) {
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
  rows.forEach((r, i) => {
    if (!r.range) return
    const sx = Math.round((r.range.startMs / totalMs) * w)
    const ex = Math.round((r.range.endMs / totalMs) * w)
    const active = i === currentIdx
    ctx.fillStyle = active
      ? 'rgba(59,130,246,0.28)'
      : r.keep ? 'rgba(16,185,129,0.18)' : 'rgba(239,68,68,0.18)'
    ctx.fillRect(sx, 0, Math.max(1, ex - sx), h)
    ctx.fillStyle = active ? 'rgb(59,130,246)' : r.keep ? 'rgb(16,185,129)' : 'rgb(239,68,68)'
    ctx.font = '10px sans-serif'
    ctx.fillText(String(i + 1), sx + 2, 12)
  })
}

type BatchMode = 'missing' | 'all'

export function BatchRecordDialog({ items, onClose, onSaved }: Props) {
  const [phase, setPhase] = useState<Phase>('idle')
  const existingCount0 = items.filter(s => s.file_path).length
  const missingCount0 = items.length - existingCount0
  const [mode, setMode] = useState<BatchMode>(missingCount0 > 0 ? 'missing' : 'all')
  const targetItems = mode === 'missing' ? items.filter(s => !s.file_path) : items
  const [currentIdx, setCurrentIdx] = useState(0)
  const [clip, setClip] = useState<RecordedClip | null>(null)
  const [rows, setRows] = useState<SegRow[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [playingIdx, setPlayingIdx] = useState<number | null>(null)
  const recRef = useRef<Awaited<ReturnType<typeof startMicRecording>> | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const stopPlayRef = useRef<(() => void) | null>(null)
  const recStartRef = useRef<number>(0)
  const [elapsed, setElapsed] = useState(0)
  const listRef = useRef<HTMLDivElement | null>(null)
  const itemRefs = useRef<(HTMLDivElement | null)[]>([])

  const existingCount = existingCount0

  useEffect(() => {
    if (phase !== 'recording') return
    const id = setInterval(() => setElapsed(Date.now() - recStartRef.current), 100)
    return () => clearInterval(id)
  }, [phase])

  useEffect(() => {
    if (phase !== 'recording') return
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space') { e.preventDefault(); advance() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, currentIdx])

  useEffect(() => {
    if (phase !== 'recording') return
    const el = itemRefs.current[currentIdx]
    if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [phase, currentIdx])

  useEffect(() => {
    if (phase !== 'review' || !clip || !canvasRef.current) return
    const data = clip.buffer.getChannelData(0)
    const total = clip.buffer.duration * 1000
    drawWaveWithSegs(canvasRef.current, data, total, rows, -1)
  }, [phase, clip, rows])

  const start = async () => {
    setErr(null)
    if (targetItems.length === 0) {
      setErr('No hay tokens para grabar en este modo.')
      return
    }
    if (mode === 'all' && existingCount > 0) {
      const ok = confirm(
        `Modo "Todos": reemplazará las ${existingCount} grabación(es) existentes que guardes en la revisión. ¿Seguir?`,
      )
      if (!ok) return
    }
    try {
      const rec = await startMicRecording()
      recRef.current = rec
      recStartRef.current = Date.now()
      setElapsed(0)
      setCurrentIdx(0)
      setPhase('recording')
    } catch (e) {
      setErr('No se pudo acceder al micrófono: ' + (e as Error).message)
    }
  }

  const advance = () => {
    setCurrentIdx(i => Math.min(targetItems.length - 1, i + 1))
  }

  const stop = async () => {
    if (!recRef.current) return
    try {
      const c = await recRef.current.stop()
      recRef.current = null
      setClip(c)
      const segs = detectVadSegmentsMs(c.buffer, { segmentGapMs: 300 })
      const next: SegRow[] = targetItems.map((s, i) => ({
        stimulus: s,
        range: segs[i] ?? null,
        keep: !!segs[i],
      }))
      setRows(next)
      setPhase('review')
    } catch (e) {
      setErr('Error al detener: ' + (e as Error).message)
      setPhase('idle')
    }
  }

  const cancel = () => {
    recRef.current?.cancel()
    recRef.current = null
    stopPlayRef.current?.()
    setPhase('idle')
    setClip(null)
    setRows([])
    setCurrentIdx(0)
  }

  const playSegment = async (i: number) => {
    if (!clip) return
    const r = rows[i]
    if (!r?.range) return
    if (playingIdx === i) { stopPlayRef.current?.(); return }
    const sf = Math.floor((r.range.startMs / 1000) * clip.buffer.sampleRate)
    const ef = Math.floor((r.range.endMs / 1000) * clip.buffer.sampleRate)
    const slice = sliceBuffer(clip.buffer, sf, ef)
    const stop = await playStimulusBuffer(slice, 60, {
      ear: 'binaural',
      rms_dbfs: r.stimulus.rms_dbfs,
      onEnd: () => { setPlayingIdx(null); stopPlayRef.current = null },
    })
    stopPlayRef.current = stop
    setPlayingIdx(i)
  }

  const toggleKeep = (i: number) => {
    setRows(rs => rs.map((r, j) => j === i ? { ...r, keep: !r.keep } : r))
  }

  const saveAll = async () => {
    if (!clip) return
    setPhase('saving')
    setErr(null)
    try {
      for (const r of rows) {
        if (!r.keep || !r.range) continue
        const sf = Math.floor((r.range.startMs / 1000) * clip.buffer.sampleRate)
        const ef = Math.floor((r.range.endMs / 1000) * clip.buffer.sampleRate)
        if (ef - sf < clip.buffer.sampleRate * 0.05) continue
        const slice = sliceBuffer(clip.buffer, sf, ef)
        const { buffer, metrics } = await processClip(slice, DEFAULT_PROC)
        const wav = encodeWav(buffer)
        if (r.stimulus.file_path) await removeStimulusFile(r.stimulus.file_path).catch(() => {})
        const absPath = await saveStimulusWav(r.stimulus.list_id, r.stimulus.position, r.stimulus.token, wav)
        await updateStimulusRecording(r.stimulus.id, {
          file_path: absPath,
          duration_ms: metrics.duration_ms,
          rms_dbfs: metrics.rms_dbfs,
          peak_dbfs: metrics.peak_dbfs,
          sample_rate: metrics.sample_rate,
          normalized: true,
        })
      }
      onSaved()
      onClose()
    } catch (e) {
      setErr('Error guardando: ' + (e as Error).message)
      setPhase('review')
    }
  }

  const detected = rows.filter(r => r.range).length
  const mismatch = phase === 'review' && detected !== targetItems.length

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={phase === 'idle' ? onClose : undefined}>
      <div
        className="bg-[var(--card)] border border-[var(--border)] rounded-lg max-w-3xl w-full p-5 shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-lg font-bold">Grabar — {targetItems.length} token(s)</h2>
            <p className="text-xs text-[var(--muted-foreground)]">
              Una sola toma. Lee cada palabra dejando ~300 ms de pausa entre ellas. El sistema auto-parte por silencios.
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-[var(--secondary)]" disabled={phase === 'saving'}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {err && <div className="text-xs text-red-500 mb-2">{err}</div>}

        {phase === 'idle' && (
          <div className="py-4 space-y-4">
            <p className="text-sm text-[var(--muted-foreground)]">
              Presiona <b>Grabar</b> y lee los tokens en orden. Usa <b>Espacio</b> o <b>Siguiente</b> para avanzar el resaltado (es solo visual, no afecta el audio).
            </p>
            <div className="border border-[var(--border)] rounded-md p-3 space-y-2">
              <div className="text-xs font-medium">¿Qué grabar?</div>
              <label className="flex items-start gap-2 cursor-pointer text-sm">
                <input
                  type="radio"
                  name="batch-mode"
                  checked={mode === 'missing'}
                  onChange={() => setMode('missing')}
                  disabled={missingCount0 === 0}
                  className="mt-1"
                />
                <span>
                  <b>Solo faltantes</b> ({missingCount0})
                  <span className="block text-[11px] text-[var(--muted-foreground)]">
                    Graba únicamente los tokens sin audio. No toca los ya grabados.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2 cursor-pointer text-sm">
                <input
                  type="radio"
                  name="batch-mode"
                  checked={mode === 'all'}
                  onChange={() => setMode('all')}
                  className="mt-1"
                />
                <span>
                  <b>Todos</b> ({items.length}) — reemplaza existentes
                  <span className="block text-[11px] text-[var(--muted-foreground)]">
                    Graba la lista entera. Al guardar se sobrescriben las {existingCount} grabaciones previas.
                  </span>
                </span>
              </label>
            </div>
            <div className="flex justify-end">
              <Button onClick={start} disabled={targetItems.length === 0}>
                <Mic className="w-4 h-4" /> Grabar {targetItems.length} token(s)
              </Button>
            </div>
          </div>
        )}

        {phase === 'recording' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-[var(--muted-foreground)]">
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                Grabando · {(elapsed / 1000).toFixed(1)} s
              </span>
              <span>{currentIdx + 1}/{targetItems.length}</span>
            </div>
            <div
              ref={listRef}
              className="border border-[var(--border)] rounded-md p-3 h-[320px] overflow-auto space-y-1"
              style={{ scrollPaddingBlock: '50%' }}
            >
              {targetItems.map((it, i) => (
                <div
                  key={it.id}
                  ref={el => { itemRefs.current[i] = el }}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded ${i === currentIdx ? 'bg-[var(--primary)]/15 border border-[var(--primary)]' : i < currentIdx ? 'opacity-50' : ''}`}
                >
                  <span className="w-6 text-xs text-[var(--muted-foreground)] text-right">{i + 1}</span>
                  <span className={`flex-1 ${i === currentIdx ? 'font-bold text-base' : 'text-sm'}`}>{it.token}</span>
                  {i < currentIdx && <Check className="w-3.5 h-3.5 text-emerald-500" />}
                </div>
              ))}
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={cancel}>Cancelar</Button>
              <Button variant="outline" size="sm" onClick={advance} disabled={currentIdx >= targetItems.length - 1}>
                <ChevronRight className="w-4 h-4" /> Siguiente (Espacio)
              </Button>
              <Button size="sm" variant="destructive" onClick={stop}>
                <Square className="w-4 h-4" /> Detener
              </Button>
            </div>
          </div>
        )}

        {(phase === 'review' || phase === 'saving') && clip && (
          <div className="space-y-3">
            <canvas
              ref={canvasRef}
              width={720}
              height={120}
              className="w-full h-[120px] rounded-md border border-[var(--border)] bg-[var(--secondary)]"
            />
            <div className="flex items-center gap-2 text-xs">
              <Wand2 className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
              <span>Detectados <b>{detected}</b> segmentos de <b>{targetItems.length}</b>.</span>
              {mismatch && (
                <span className="inline-flex items-center gap-1 text-amber-500">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  No coincide — re-graba o marca los faltantes.
                </span>
              )}
            </div>
            <div className="border border-[var(--border)] rounded-md max-h-[280px] overflow-auto">
              {rows.map((r, i) => (
                <div
                  key={r.stimulus.id}
                  className={`flex items-center gap-2 px-2 py-1.5 border-b border-[var(--border)]/40 last:border-b-0 ${!r.range ? 'bg-red-500/5' : r.keep ? 'bg-emerald-500/5' : 'opacity-50'}`}
                >
                  <span className="w-6 text-xs text-[var(--muted-foreground)] text-right">{i + 1}</span>
                  <span className="flex-1 text-sm font-medium">{r.stimulus.token}</span>
                  {r.range ? (
                    <>
                      <span className="text-[10px] text-[var(--muted-foreground)]">
                        {(r.range.endMs - r.range.startMs)} ms
                      </span>
                      <Button size="sm" variant="ghost" onClick={() => playSegment(i)} disabled={phase === 'saving'}>
                        {playingIdx === i ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      </Button>
                      <label className="inline-flex items-center gap-1 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={r.keep}
                          onChange={() => toggleKeep(i)}
                          disabled={phase === 'saving'}
                        />
                        usar
                      </label>
                    </>
                  ) : (
                    <span className="text-[11px] text-red-500">sin detectar</span>
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={cancel} disabled={phase === 'saving'}>
                Re-grabar
              </Button>
              <Button size="sm" onClick={saveAll} disabled={phase === 'saving' || rows.every(r => !r.keep)}>
                <Check className="w-4 h-4" /> {phase === 'saving' ? 'Guardando…' : 'Guardar seleccionados'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
