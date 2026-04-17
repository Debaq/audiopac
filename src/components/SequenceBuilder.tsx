import { useState } from 'react'
import { Plus, X, Play, Copy, Shuffle, GripVertical, Minus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { playSequence, ensureRunning } from '@/lib/audio/engine'
import type { TestConfig } from '@/types'
import { cn } from '@/lib/utils'

interface Props {
  sequences: string[]
  onChange: (seqs: string[]) => void
  config: TestConfig
  patternLength: number
  readOnly?: boolean
}

const TONE_PALETTE = ['#6B1F2E', '#A63446', '#D17682', '#2B7A78', '#DDB967', '#5B8E7D']

export function SequenceBuilder({ sequences, onChange, config, patternLength, readOnly }: Props) {
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null)
  const tones = Object.keys(config.tones)

  const toneColor = (key: string): string => {
    const idx = tones.indexOf(key)
    return TONE_PALETTE[idx % TONE_PALETTE.length]
  }

  const toneSize = (key: string): { w: number; h: number; label: string } => {
    const t = config.tones[key]
    const dur = t?.duration_ms ?? config.duration_ms ?? 300
    const freq = t?.frequency ?? config.frequency ?? 1000
    const maxDur = Math.max(...Object.values(config.tones).map(x => x.duration_ms ?? config.duration_ms ?? 300), 100)
    const w = Math.max(24, Math.min(80, 24 + (dur / maxDur) * 56))
    const maxFreq = Math.max(...Object.values(config.tones).map(x => x.frequency ?? config.frequency ?? 1000), 500)
    const minFreq = Math.min(...Object.values(config.tones).map(x => x.frequency ?? config.frequency ?? 1000), 500)
    const range = Math.max(1, maxFreq - minFreq)
    const h = 28 + ((freq - minFreq) / range) * 32
    return { w, h, label: t?.label ?? key }
  }

  const addSequence = () => {
    const first = tones[0] ?? 'L'
    onChange([...sequences, first.repeat(patternLength)])
  }

  const addRandom = () => {
    const seq = Array.from({ length: patternLength }, () => tones[Math.floor(Math.random() * tones.length)]).join('')
    onChange([...sequences, seq])
  }

  const removeSequence = (idx: number) => {
    onChange(sequences.filter((_, i) => i !== idx))
  }

  const duplicate = (idx: number) => {
    const copy = [...sequences]
    copy.splice(idx + 1, 0, sequences[idx])
    onChange(copy)
  }

  const updateToneAt = (seqIdx: number, pos: number, tone: string) => {
    const seq = sequences[seqIdx]
    const next = seq.substring(0, pos) + tone + seq.substring(pos + 1)
    const copy = [...sequences]
    copy[seqIdx] = next
    onChange(copy)
  }

  const appendTone = (seqIdx: number) => {
    const copy = [...sequences]
    copy[seqIdx] = sequences[seqIdx] + (tones[0] ?? 'L')
    onChange(copy)
  }

  const popTone = (seqIdx: number) => {
    const copy = [...sequences]
    if (copy[seqIdx].length <= 1) return
    copy[seqIdx] = sequences[seqIdx].slice(0, -1)
    onChange(copy)
  }

  const removeToneAt = (seqIdx: number, pos: number) => {
    const seq = sequences[seqIdx]
    if (seq.length <= 1) return
    const copy = [...sequences]
    copy[seqIdx] = seq.substring(0, pos) + seq.substring(pos + 1)
    onChange(copy)
  }

  const playSeq = async (seq: string) => {
    await ensureRunning()
    await playSequence(seq, config)
  }

  const onDragStart = (idx: number) => setDraggedIdx(idx)
  const onDragOver = (e: React.DragEvent) => e.preventDefault()
  const onDrop = (idx: number) => {
    if (draggedIdx === null || draggedIdx === idx) return
    const copy = [...sequences]
    const [moved] = copy.splice(draggedIdx, 1)
    copy.splice(idx, 0, moved)
    onChange(copy)
    setDraggedIdx(null)
  }

  return (
    <div className="space-y-2">
      {sequences.length === 0 && (
        <div className="text-center py-12 border-2 border-dashed border-[var(--border)] rounded-xl text-[var(--muted-foreground)]">
          <p className="mb-3">Aún no hay secuencias</p>
          {!readOnly && (
            <div className="flex gap-2 justify-center">
              <Button size="sm" onClick={addSequence}><Plus className="w-3 h-3" /> Agregar</Button>
              <Button size="sm" variant="outline" onClick={addRandom}><Shuffle className="w-3 h-3" /> Aleatoria</Button>
            </div>
          )}
        </div>
      )}

      {sequences.map((seq, i) => (
        <div
          key={i}
          draggable={!readOnly}
          onDragStart={() => onDragStart(i)}
          onDragOver={onDragOver}
          onDrop={() => onDrop(i)}
          className={cn(
            'group flex items-center gap-2 p-2 rounded-lg bg-[var(--secondary)]/50 hover:bg-[var(--secondary)] transition-colors',
            draggedIdx === i && 'opacity-50'
          )}
        >
          {!readOnly && <GripVertical className="w-4 h-4 text-[var(--muted-foreground)] cursor-grab" />}
          <span className="w-8 text-xs font-mono text-[var(--muted-foreground)] text-right">{i + 1}</span>

          <div className="flex items-end gap-1 min-h-[64px] py-1">
            {seq.split('').map((ch, pos) => {
              const { w, h, label } = toneSize(ch)
              return (
                <ToneBlock
                  key={pos}
                  tone={ch}
                  label={label}
                  color={toneColor(ch)}
                  width={w}
                  height={h}
                  readOnly={readOnly}
                  tones={tones}
                  onCycle={(next) => updateToneAt(i, pos, next)}
                  onRemove={seq.length > 1 ? () => removeToneAt(i, pos) : undefined}
                />
              )
            })}
            {!readOnly && (
              <div className="flex flex-col gap-1 ml-1">
                <button
                  type="button"
                  onClick={() => appendTone(i)}
                  className="w-7 h-7 rounded-md border-2 border-dashed border-[var(--border)] hover:border-[var(--primary)] hover:text-[var(--primary)] text-[var(--muted-foreground)] flex items-center justify-center transition-colors"
                  title="Añadir tono al final"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
                {seq.length > 1 && (
                  <button
                    type="button"
                    onClick={() => popTone(i)}
                    className="w-7 h-7 rounded-md border-2 border-dashed border-[var(--border)] hover:border-[var(--destructive)] hover:text-[var(--destructive)] text-[var(--muted-foreground)] flex items-center justify-center transition-colors"
                    title="Quitar último tono"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>

          <code className="text-xs font-mono text-[var(--muted-foreground)] px-2 ml-auto">
            {seq} <span className="opacity-50">({seq.length})</span>
          </code>

          <div className="flex gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
            <button onClick={() => playSeq(seq)} className="p-1.5 rounded hover:bg-[var(--primary)]/10 text-[var(--primary)]" title="Reproducir">
              <Play className="w-3.5 h-3.5" />
            </button>
            {!readOnly && (
              <>
                <button onClick={() => duplicate(i)} className="p-1.5 rounded hover:bg-[var(--secondary)] text-[var(--muted-foreground)]" title="Duplicar">
                  <Copy className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => removeSequence(i)} className="p-1.5 rounded hover:bg-[var(--destructive)]/10 text-[var(--destructive)]" title="Eliminar">
                  <X className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        </div>
      ))}

      {sequences.length > 0 && !readOnly && (
        <div className="flex gap-2 pt-2">
          <Button size="sm" variant="outline" onClick={addSequence}><Plus className="w-3 h-3" /> Agregar</Button>
          <Button size="sm" variant="outline" onClick={addRandom}><Shuffle className="w-3 h-3" /> Aleatoria</Button>
          <div className="ml-auto text-xs text-[var(--muted-foreground)] self-center">
            {sequences.length} secuencia{sequences.length !== 1 ? 's' : ''} · longitud por defecto {patternLength}
          </div>
        </div>
      )}
    </div>
  )
}

function ToneBlock({
  tone, label, color, width, height, readOnly, tones, onCycle, onRemove,
}: {
  tone: string
  label: string
  color: string
  width: number
  height: number
  readOnly?: boolean
  tones: string[]
  onCycle: (next: string) => void
  onRemove?: () => void
}) {
  const handleClick = (e: React.MouseEvent) => {
    if (readOnly) return
    if (e.shiftKey && onRemove) { onRemove(); return }
    const idx = tones.indexOf(tone)
    const next = tones[(idx + 1) % tones.length]
    onCycle(next)
  }
  return (
    <div className="relative group">
      <button
        type="button"
        onClick={handleClick}
        onContextMenu={(e) => { e.preventDefault(); if (!readOnly && onRemove) onRemove() }}
        disabled={readOnly}
        style={{ width, height, background: color }}
        className={cn(
          'rounded-md flex items-center justify-center text-white font-bold text-sm shadow-md transition-transform',
          !readOnly && 'hover:scale-110 hover:shadow-lg cursor-pointer',
          readOnly && 'cursor-default'
        )}
        title={readOnly ? `${tone} - ${label}` : `${tone} - ${label} (click: cambiar · shift+click o click derecho: eliminar)`}
      >
        {tone}
      </button>
      {!readOnly && onRemove && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove() }}
          className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-[var(--destructive)] text-white opacity-0 group-hover:opacity-100 flex items-center justify-center shadow transition-opacity"
          title="Eliminar tono"
        >
          <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  )
}
