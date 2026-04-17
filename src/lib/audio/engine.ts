import type { TestConfig, Ear } from '@/types'

export interface TonePlan {
  frequency: number
  duration_ms: number
  startOffset_ms: number
}

export interface SequencePlan {
  tones: TonePlan[]
  totalDuration_ms: number
}

let sharedCtx: AudioContext | null = null

export function getAudioContext(): AudioContext {
  if (!sharedCtx || sharedCtx.state === 'closed') {
    sharedCtx = new AudioContext({ sampleRate: 48000, latencyHint: 'interactive' })
  }
  return sharedCtx
}

export async function ensureRunning(): Promise<AudioContext> {
  const ctx = getAudioContext()
  if (ctx.state === 'suspended') await ctx.resume()
  return ctx
}

export async function closeAudioContext() {
  if (sharedCtx && sharedCtx.state !== 'closed') {
    await sharedCtx.close()
    sharedCtx = null
  }
}

/**
 * dB SPL aproximado a gain lineal. Referencia 0 dBFS = ~85 dB SPL típico en headphones.
 * Para calibración clínica real se debe ajustar con sonómetro.
 */
export function dbToGain(db_spl: number, ref_db = 85): number {
  const db_fs = db_spl - ref_db
  return Math.pow(10, db_fs / 20)
}

export function buildSequencePlan(pattern: string, config: TestConfig): SequencePlan {
  const tones: TonePlan[] = []
  let offset = 0
  for (const ch of pattern) {
    const tone = config.tones[ch]
    if (!tone) throw new Error(`Tono no definido: ${ch}`)
    const duration = tone.duration_ms ?? config.duration_ms ?? 200
    const frequency = tone.frequency ?? config.frequency ?? 1000
    tones.push({ frequency, duration_ms: duration, startOffset_ms: offset })
    offset += duration + config.isi_ms
  }
  const total = offset - config.isi_ms
  return { tones, totalDuration_ms: total }
}

function channelRouting(ctx: AudioContext, ear: Ear) {
  const merger = ctx.createChannelMerger(2)
  const leftGain = ctx.createGain()
  const rightGain = ctx.createGain()
  leftGain.gain.value = ear === 'right' ? 0 : 1
  rightGain.gain.value = ear === 'left' ? 0 : 1
  leftGain.connect(merger, 0, 0)
  rightGain.connect(merger, 0, 1)
  return { merger, leftGain, rightGain }
}

export async function playSequence(
  pattern: string,
  config: TestConfig,
  options?: { ear?: Ear; onStart?: () => void; onEnd?: () => void }
): Promise<void> {
  const ctx = await ensureRunning()
  const ear = options?.ear ?? config.channel
  const plan = buildSequencePlan(pattern, config)
  const masterGain = ctx.createGain()
  masterGain.gain.value = dbToGain(config.level_db ?? 60)

  const { merger, leftGain, rightGain } = channelRouting(ctx, ear)
  merger.connect(masterGain)
  masterGain.connect(ctx.destination)

  const envMs = Math.max(1, config.envelope_ms ?? 10)
  const envSec = envMs / 1000
  const startTime = ctx.currentTime + 0.05

  for (const tone of plan.tones) {
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = tone.frequency

    const toneGain = ctx.createGain()
    const t0 = startTime + tone.startOffset_ms / 1000
    const t1 = t0 + tone.duration_ms / 1000
    toneGain.gain.setValueAtTime(0, t0)
    toneGain.gain.linearRampToValueAtTime(1, t0 + envSec)
    toneGain.gain.setValueAtTime(1, t1 - envSec)
    toneGain.gain.linearRampToValueAtTime(0, t1)

    osc.connect(toneGain)
    toneGain.connect(leftGain)
    toneGain.connect(rightGain)

    osc.start(t0)
    osc.stop(t1 + 0.01)
  }

  options?.onStart?.()
  return new Promise((resolve) => {
    const durationMs = plan.totalDuration_ms + 100
    setTimeout(() => {
      options?.onEnd?.()
      resolve()
    }, durationMs + 50)
  })
}

export async function playTonePreview(frequency: number, duration_ms = 400, level_db = 60) {
  const ctx = await ensureRunning()
  const gain = ctx.createGain()
  gain.gain.value = dbToGain(level_db)
  const env = ctx.createGain()
  const osc = ctx.createOscillator()
  osc.type = 'sine'
  osc.frequency.value = frequency
  const t0 = ctx.currentTime + 0.02
  const t1 = t0 + duration_ms / 1000
  env.gain.setValueAtTime(0, t0)
  env.gain.linearRampToValueAtTime(1, t0 + 0.01)
  env.gain.setValueAtTime(1, t1 - 0.01)
  env.gain.linearRampToValueAtTime(0, t1)
  osc.connect(env)
  env.connect(gain)
  gain.connect(ctx.destination)
  osc.start(t0)
  osc.stop(t1 + 0.02)
}
