import type { TestConfig, Ear, NoiseType, NoiseMix } from '@/types'

export interface TonePlan {
  frequency: number
  duration_ms: number
  startOffset_ms: number
  level_db?: number
  ear?: Ear
  gain_l?: number
  gain_r?: number
  kind?: 'tone' | 'noise'
  noise_type?: NoiseType
  center_hz?: number
  bandwidth_hz?: number
  gap_at_ms?: number
  gap_width_ms?: number
  noise_mix?: NoiseMix
  phase_invert_right?: boolean
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

export const DEFAULT_REF_DB = 85
let activeRefDb = DEFAULT_REF_DB

export interface CalibCurvePoint {
  frequency_hz: number
  ear: Ear
  ref_db_spl: number
}

let activeCurve: CalibCurvePoint[] = []

export function setActiveRefDb(ref_db: number) {
  activeRefDb = ref_db
}

export function getActiveRefDb(): number {
  return activeRefDb
}

export function setActiveCalibrationCurve(points: CalibCurvePoint[]) {
  activeCurve = points.slice()
}

export function getActiveCalibrationCurve(): CalibCurvePoint[] {
  return activeCurve.slice()
}

export type NoiseCalibKind = 'white' | 'pink' | 'ssn'
export type NoiseRefByType = Partial<Record<NoiseCalibKind, number>>

let activeNoiseRef: NoiseRefByType = {}

export function setActiveNoiseRef(ref: NoiseRefByType) {
  activeNoiseRef = { ...ref }
}

export function getActiveNoiseRef(): NoiseRefByType {
  return { ...activeNoiseRef }
}

/**
 * Resuelve ref dB SPL @ 0 dBFS para tipo de ruido.
 * Si hay calibración activa para ese tipo, la usa. Sino, fallback al heurístico
 * antiguo (ref_tono + RMS estimado del buffer): pink≈-15, white≈-5, ssn≈-20.
 */
export function resolveNoiseRefDb(
  type: NoiseCalibKind,
  ear: Ear = 'binaural',
  override?: NoiseRefByType,
): number {
  const tbl = override ?? activeNoiseRef
  const v = tbl[type]
  if (v !== undefined) return v
  const toneRef = resolveRefDb(1000, ear)
  const rms = type === 'ssn' ? -20 : type === 'pink' ? -15 : -5
  return toneRef + rms
}

/**
 * Resuelve ref_db para (freq, ear) interpolando log-freq.
 * Prioridad: puntos del mismo oído → puntos binaurales → activeRefDb escalar.
 */
export function resolveRefDb(frequency_hz: number, ear: Ear = 'binaural', curve?: CalibCurvePoint[]): number {
  const points = curve ?? activeCurve
  if (points.length === 0) return activeRefDb
  const byEar = (e: Ear) => points.filter(p => p.ear === e).sort((a, b) => a.frequency_hz - b.frequency_hz)
  let cand = byEar(ear)
  if (cand.length === 0) cand = byEar('binaural')
  if (cand.length === 0) cand = byEar(ear === 'left' ? 'right' : 'left')
  if (cand.length === 0) return activeRefDb
  if (cand.length === 1) return cand[0].ref_db_spl
  if (frequency_hz <= cand[0].frequency_hz) return cand[0].ref_db_spl
  if (frequency_hz >= cand[cand.length - 1].frequency_hz) return cand[cand.length - 1].ref_db_spl
  for (let i = 0; i < cand.length - 1; i++) {
    const a = cand[i], b = cand[i + 1]
    if (frequency_hz >= a.frequency_hz && frequency_hz <= b.frequency_hz) {
      const la = Math.log2(a.frequency_hz)
      const lb = Math.log2(b.frequency_hz)
      const lf = Math.log2(frequency_hz)
      const t = (lf - la) / (lb - la)
      return a.ref_db_spl + t * (b.ref_db_spl - a.ref_db_spl)
    }
  }
  return activeRefDb
}

/**
 * dB SPL aproximado a gain lineal. Referencia: ref_db = dB SPL medidos a 0 dBFS.
 * Con `freq`+`ear`, resuelve por curva multi-freq. Sin args, usa `activeRefDb` escalar.
 */
export function dbToGain(db_spl: number, ref_db?: number, freq?: number, ear?: Ear): number {
  let ref: number
  if (ref_db !== undefined) ref = ref_db
  else if (freq !== undefined) ref = resolveRefDb(freq, ear)
  else ref = activeRefDb
  const db_fs = db_spl - ref
  return Math.pow(10, db_fs / 20)
}

function buildSidePlan(
  chars: string,
  config: TestConfig,
  earOverride?: Ear
): { tones: TonePlan[]; total: number } {
  const tones: TonePlan[] = []
  let offset = 0
  for (const ch of chars) {
    const tone = config.tones[ch]
    if (!tone) throw new Error(`Tono no definido: ${ch}`)
    const duration = tone.duration_ms ?? config.duration_ms ?? 200
    const frequency = tone.frequency ?? config.frequency ?? 1000
    tones.push({
      frequency,
      duration_ms: duration,
      startOffset_ms: offset,
      level_db: tone.level_db,
      ear: earOverride ?? tone.ear,
      gain_l: earOverride ? undefined : tone.gain_l,
      gain_r: earOverride ? undefined : tone.gain_r,
      kind: tone.kind,
      noise_type: tone.noise_type,
      center_hz: tone.center_hz,
      bandwidth_hz: tone.bandwidth_hz,
      gap_at_ms: tone.gap_at_ms,
      gap_width_ms: tone.gap_width_ms,
      noise_mix: tone.noise_mix,
      phase_invert_right: tone.phase_invert_right,
    })
    offset += duration + config.isi_ms
  }
  const total = offset - config.isi_ms
  return { tones, total }
}

/**
 * Genera plan de reproducción. Patrón con `|` = dichotic:
 *   "LHL|HLH" → parte izq "LHL" al oído L, parte der "HLH" al oído R, simultáneas.
 *   Cada parte avanza con su propio ISI desde t=0; totalDuration = max de ambas.
 */
export function buildSequencePlan(pattern: string, config: TestConfig): SequencePlan {
  if (pattern.includes('|')) {
    const parts = pattern.split('|')
    if (parts.length !== 2) throw new Error('Patrón dichotic debe tener exactamente un "|"')
    const left = buildSidePlan(parts[0], config, 'left')
    const right = buildSidePlan(parts[1], config, 'right')
    return {
      tones: [...left.tones, ...right.tones],
      totalDuration_ms: Math.max(left.total, right.total),
    }
  }
  const { tones, total } = buildSidePlan(pattern, config)
  return { tones, totalDuration_ms: total }
}

let whiteNoiseBuffer: AudioBuffer | null = null
let pinkNoiseBuffer: AudioBuffer | null = null

function getWhiteNoiseBuffer(ctx: AudioContext): AudioBuffer {
  if (whiteNoiseBuffer && whiteNoiseBuffer.sampleRate === ctx.sampleRate) return whiteNoiseBuffer
  const duration = 4
  const buf = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  whiteNoiseBuffer = buf
  return buf
}

function getPinkNoiseBuffer(ctx: AudioContext): AudioBuffer {
  if (pinkNoiseBuffer && pinkNoiseBuffer.sampleRate === ctx.sampleRate) return pinkNoiseBuffer
  const duration = 4
  const buf = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate)
  const data = buf.getChannelData(0)
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0
  for (let i = 0; i < data.length; i++) {
    const w = Math.random() * 2 - 1
    b0 = 0.99886 * b0 + w * 0.0555179
    b1 = 0.99332 * b1 + w * 0.0750759
    b2 = 0.96900 * b2 + w * 0.1538520
    b3 = 0.86650 * b3 + w * 0.3104856
    b4 = 0.55000 * b4 + w * 0.5329522
    b5 = -0.7616 * b5 - w * 0.0168980
    data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11
    b6 = w * 0.115926
  }
  pinkNoiseBuffer = buf
  return buf
}

function earGains(ear: Ear): { l: number; r: number } {
  if (ear === 'left') return { l: 1, r: 0 }
  if (ear === 'right') return { l: 0, r: 1 }
  return { l: 1, r: 1 }
}

export async function playSequence(
  pattern: string,
  config: TestConfig,
  options?: { ear?: Ear; refDb?: number; curve?: CalibCurvePoint[]; onStart?: () => void; onEnd?: () => void }
): Promise<void> {
  const ctx = await ensureRunning()
  const sessionEar = options?.ear ?? config.channel
  const scalarRef = options?.refDb
  const curve = options?.curve
  const plan = buildSequencePlan(pattern, config)

  const merger = ctx.createChannelMerger(2)
  merger.connect(ctx.destination)

  const envMs = Math.max(1, config.envelope_ms ?? 10)
  const envSec = envMs / 1000
  const startTime = ctx.currentTime + 0.05

  function makeNoiseHead(
    nt: NoiseType | undefined,
    center_hz?: number,
    bandwidth_hz?: number,
    fallbackFreq?: number
  ): { source: AudioScheduledSourceNode; head: AudioNode } {
    const src = ctx.createBufferSource()
    src.buffer = (nt === 'pink' || nt === 'ssn') ? getPinkNoiseBuffer(ctx) : getWhiteNoiseBuffer(ctx)
    src.loop = true
    if (nt === 'ssn') {
      const lp = ctx.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = 1000
      lp.Q.value = 0.707
      src.connect(lp)
      return { source: src, head: lp }
    }
    if (nt === 'narrow') {
      const filt = ctx.createBiquadFilter()
      filt.type = 'bandpass'
      const center = center_hz ?? fallbackFreq ?? 1000
      const bw = bandwidth_hz ?? Math.max(100, center * 0.2)
      filt.frequency.value = center
      filt.Q.value = center / bw
      src.connect(filt)
      return { source: src, head: filt }
    }
    return { source: src, head: src }
  }

  const refFor = (freq: number, ear: Ear): number => {
    if (curve && curve.length > 0) return resolveRefDb(freq, ear, curve)
    if (scalarRef !== undefined) return scalarRef
    return resolveRefDb(freq, ear)
  }

  for (const tone of plan.tones) {
    const levelDb = tone.level_db ?? config.level_db ?? 60
    const effEar: Ear = tone.ear ?? sessionEar
    const peak = dbToGain(levelDb, refFor(tone.frequency, effEar))
    const t0 = startTime + tone.startOffset_ms / 1000
    const t1 = t0 + tone.duration_ms / 1000

    const toneGain = ctx.createGain()
    toneGain.gain.setValueAtTime(0, t0)
    toneGain.gain.linearRampToValueAtTime(peak, t0 + envSec)

    if (tone.kind === 'noise' && tone.gap_at_ms !== undefined && tone.gap_width_ms && tone.gap_width_ms > 0) {
      const gapStart = t0 + tone.gap_at_ms / 1000
      const gapEnd = gapStart + tone.gap_width_ms / 1000
      const ramp = Math.min(0.002, tone.gap_width_ms / 4000)
      toneGain.gain.setValueAtTime(peak, Math.max(t0 + envSec, gapStart - ramp))
      toneGain.gain.linearRampToValueAtTime(0, gapStart)
      toneGain.gain.setValueAtTime(0, gapEnd)
      toneGain.gain.linearRampToValueAtTime(peak, gapEnd + ramp)
    }

    toneGain.gain.setValueAtTime(peak, t1 - envSec)
    toneGain.gain.linearRampToValueAtTime(0, t1)

    const useFineGain = tone.gain_l !== undefined || tone.gain_r !== undefined
    let lGain: number
    let rGain: number
    if (useFineGain) {
      lGain = tone.gain_l ?? 0
      rGain = tone.gain_r ?? 0
    } else {
      const eff = tone.ear ?? sessionEar
      ;({ l: lGain, r: rGain } = earGains(eff))
    }

    const leftNode = ctx.createGain()
    const rightNode = ctx.createGain()
    leftNode.gain.value = lGain
    rightNode.gain.value = rGain * (tone.phase_invert_right ? -1 : 1)

    let source: AudioScheduledSourceNode
    let head: AudioNode
    if (tone.kind === 'noise') {
      const n = makeNoiseHead(tone.noise_type, tone.center_hz, tone.bandwidth_hz, tone.frequency)
      source = n.source
      head = n.head
    } else {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = tone.frequency
      source = osc
      head = osc
    }

    head.connect(toneGain)
    toneGain.connect(leftNode)
    toneGain.connect(rightNode)
    leftNode.connect(merger, 0, 0)
    rightNode.connect(merger, 0, 1)

    source.start(t0)
    source.stop(t1 + 0.01)

    if (tone.noise_mix) {
      const nm = tone.noise_mix
      const nPeak = dbToGain(nm.level_db, refFor(tone.frequency, effEar))
      const nGain = ctx.createGain()
      nGain.gain.setValueAtTime(0, t0)
      nGain.gain.linearRampToValueAtTime(nPeak, t0 + envSec)
      nGain.gain.setValueAtTime(nPeak, t1 - envSec)
      nGain.gain.linearRampToValueAtTime(0, t1)

      const nNode = makeNoiseHead(nm.noise_type, nm.center_hz, nm.bandwidth_hz, tone.frequency)
      const nL = ctx.createGain()
      const nR = ctx.createGain()
      nL.gain.value = lGain
      nR.gain.value = rGain

      nNode.head.connect(nGain)
      nGain.connect(nL)
      nGain.connect(nR)
      nL.connect(merger, 0, 0)
      nR.connect(merger, 0, 1)

      nNode.source.start(t0)
      nNode.source.stop(t1 + 0.01)
    }
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

export async function playTonePreview(
  frequency: number,
  duration_ms = 400,
  level_db = 60,
  opts?: { ear?: Ear; gain_l?: number; gain_r?: number; refDb?: number }
) {
  const ctx = await ensureRunning()
  const ref = opts?.refDb !== undefined ? opts.refDb : resolveRefDb(frequency, opts?.ear ?? 'binaural')
  const peak = dbToGain(level_db, ref)
  const env = ctx.createGain()
  const osc = ctx.createOscillator()
  osc.type = 'sine'
  osc.frequency.value = frequency
  const t0 = ctx.currentTime + 0.02
  const t1 = t0 + duration_ms / 1000
  env.gain.setValueAtTime(0, t0)
  env.gain.linearRampToValueAtTime(peak, t0 + 0.01)
  env.gain.setValueAtTime(peak, t1 - 0.01)
  env.gain.linearRampToValueAtTime(0, t1)

  const useFineGain = opts?.gain_l !== undefined || opts?.gain_r !== undefined
  let lGain: number
  let rGain: number
  if (useFineGain) {
    lGain = opts?.gain_l ?? 0
    rGain = opts?.gain_r ?? 0
  } else {
    ;({ l: lGain, r: rGain } = earGains(opts?.ear ?? 'binaural'))
  }

  const merger = ctx.createChannelMerger(2)
  const leftNode = ctx.createGain()
  const rightNode = ctx.createGain()
  leftNode.gain.value = lGain
  rightNode.gain.value = rGain

  osc.connect(env)
  env.connect(leftNode)
  env.connect(rightNode)
  leftNode.connect(merger, 0, 0)
  rightNode.connect(merger, 0, 1)
  merger.connect(ctx.destination)

  osc.start(t0)
  osc.stop(t1 + 0.02)
}

/**
 * Burst corto en dBFS directo (sin mapeo SPL). Para verificación pre-sesión.
 */
export async function playBurstDbfs(
  frequency: number,
  duration_ms: number,
  dbfs: number,
  ear: Ear = 'binaural'
): Promise<void> {
  const ctx = await ensureRunning()
  const peak = Math.pow(10, dbfs / 20)
  const osc = ctx.createOscillator()
  osc.type = 'sine'
  osc.frequency.value = frequency
  const env = ctx.createGain()
  const t0 = ctx.currentTime + 0.02
  const t1 = t0 + duration_ms / 1000
  env.gain.setValueAtTime(0, t0)
  env.gain.linearRampToValueAtTime(peak, t0 + 0.015)
  env.gain.setValueAtTime(peak, t1 - 0.015)
  env.gain.linearRampToValueAtTime(0, t1)

  const merger = ctx.createChannelMerger(2)
  const { l, r } = earGains(ear)
  const leftNode = ctx.createGain()
  const rightNode = ctx.createGain()
  leftNode.gain.value = l
  rightNode.gain.value = r

  osc.connect(env)
  env.connect(leftNode)
  env.connect(rightNode)
  leftNode.connect(merger, 0, 0)
  rightNode.connect(merger, 0, 1)
  merger.connect(ctx.destination)

  osc.start(t0)
  osc.stop(t1 + 0.02)
  return new Promise(resolve => setTimeout(resolve, duration_ms + 60))
}

/**
 * Reproduce un estímulo grabado (AudioBuffer) al nivel SPL indicado.
 * Usa RMS del archivo para mapear a nivel clínico:
 *   output_rms_spl = ref_db + rms_dbfs + 20·log10(gain)
 * Para obtener level_db SPL: gain = 10^((level_db − ref − rms_dbfs)/20)
 * Si rms_dbfs no está medido, asume −20 dBFS (target post-normalización).
 */
export async function playStimulusBuffer(
  buffer: AudioBuffer,
  level_db: number,
  opts: { ear?: Ear; rms_dbfs?: number | null; refDb?: number; onEnd?: () => void } = {}
): Promise<() => void> {
  const ctx = await ensureRunning()
  const ear = opts.ear ?? 'binaural'
  const rms = opts.rms_dbfs ?? -20
  const ref = opts.refDb ?? resolveRefDb(1000, ear)
  const gain = dbToGain(level_db - rms, ref)

  const src = ctx.createBufferSource()
  src.buffer = buffer
  const g = ctx.createGain()
  g.gain.value = gain

  const merger = ctx.createChannelMerger(2)
  const { l, r } = earGains(ear)
  const leftNode = ctx.createGain()
  const rightNode = ctx.createGain()
  leftNode.gain.value = l
  rightNode.gain.value = r

  src.connect(g)
  g.connect(leftNode)
  g.connect(rightNode)
  leftNode.connect(merger, 0, 0)
  rightNode.connect(merger, 0, 1)
  merger.connect(ctx.destination)

  src.onended = () => opts.onEnd?.()
  src.start()
  return () => { try { src.stop() } catch {} }
}

/**
 * Reproduce un estímulo con ruido enmascarante simultáneo (HINT / SinB).
 * - Voz: buffer al `level_db` SPL (usa rms_dbfs para mapeo, igual que playStimulusBuffer)
 * - Ruido: loop del buffer blanco/rosa al `noise_level_db` SPL, arranca 200 ms antes y
 *   termina 200 ms después con fade 50 ms para evitar clicks y enmascarar desde el primer fonema.
 * onEnd dispara al terminar la voz.
 */
export async function playStimulusWithNoise(
  buffer: AudioBuffer,
  level_db: number,
  noise_level_db: number,
  noise_type: NoiseType = 'pink',
  opts: { ear?: Ear; rms_dbfs?: number | null; refDb?: number; onEnd?: () => void } = {}
): Promise<() => void> {
  const ctx = await ensureRunning()
  const ear = opts.ear ?? 'binaural'
  const rms = opts.rms_dbfs ?? -20
  const ref = opts.refDb ?? resolveRefDb(1000, ear)
  const voiceGain = dbToGain(level_db - rms, ref)
  // Ruido: ref real medido (calibración) o fallback heurístico por tipo de buffer.
  const noiseRef = resolveNoiseRefDb(noise_type as NoiseCalibKind, ear)
  const noiseGain = Math.pow(10, (noise_level_db - noiseRef) / 20)

  const merger = ctx.createChannelMerger(2)
  const { l, r } = earGains(ear)

  // Voz
  const srcV = ctx.createBufferSource()
  srcV.buffer = buffer
  const gV = ctx.createGain()
  gV.gain.value = voiceGain
  const vL = ctx.createGain(); vL.gain.value = l
  const vR = ctx.createGain(); vR.gain.value = r
  srcV.connect(gV); gV.connect(vL); gV.connect(vR)
  vL.connect(merger, 0, 0); vR.connect(merger, 0, 1)

  // Ruido
  const noiseBuf = (noise_type === 'pink' || noise_type === 'ssn') ? getPinkNoiseBuffer(ctx) : getWhiteNoiseBuffer(ctx)
  const srcN = ctx.createBufferSource()
  srcN.buffer = noiseBuf
  srcN.loop = true
  const gN = ctx.createGain()
  const nL = ctx.createGain(); nL.gain.value = l
  const nR = ctx.createGain(); nR.gain.value = r
  let noiseHead: AudioNode = srcN
  if (noise_type === 'ssn') {
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 1000
    lp.Q.value = 0.707
    srcN.connect(lp)
    noiseHead = lp
  }
  noiseHead.connect(gN); gN.connect(nL); gN.connect(nR)
  nL.connect(merger, 0, 0); nR.connect(merger, 0, 1)
  merger.connect(ctx.destination)

  const t0 = ctx.currentTime + 0.05
  const leadIn = 0.2
  const fade = 0.05
  const tNoiseStart = t0
  const tVoiceStart = t0 + leadIn
  const tVoiceEnd = tVoiceStart + buffer.duration
  const tNoiseEnd = tVoiceEnd + leadIn

  gN.gain.setValueAtTime(0, tNoiseStart)
  gN.gain.linearRampToValueAtTime(noiseGain, tNoiseStart + fade)
  gN.gain.setValueAtTime(noiseGain, tNoiseEnd - fade)
  gN.gain.linearRampToValueAtTime(0, tNoiseEnd)

  srcN.start(tNoiseStart)
  srcN.stop(tNoiseEnd + 0.02)
  srcV.start(tVoiceStart)
  srcV.onended = () => opts.onEnd?.()

  return () => {
    try { srcV.stop() } catch {}
    try { srcN.stop() } catch {}
  }
}

/**
 * Reproduce dos AudioBuffer simultáneos, uno por oído, sincronizados (mismo startTime).
 * Pensado para Dichotic Digits: digitoL al L y digitoR al R. Cada uno con su propio
 * rms_dbfs y al mismo level_db SPL por oído. Llama onEnd cuando el MÁS LARGO termina.
 */
export async function playStimulusPair(
  bufferL: AudioBuffer,
  bufferR: AudioBuffer,
  level_db: number,
  opts: {
    rms_dbfs_l?: number | null
    rms_dbfs_r?: number | null
    refDb?: number
    onEnd?: () => void
  } = {}
): Promise<() => void> {
  const ctx = await ensureRunning()
  const rmsL = opts.rms_dbfs_l ?? -20
  const rmsR = opts.rms_dbfs_r ?? -20
  const ref = opts.refDb ?? resolveRefDb(1000, 'binaural')
  const gainL = dbToGain(level_db - rmsL, ref)
  const gainR = dbToGain(level_db - rmsR, ref)

  const merger = ctx.createChannelMerger(2)

  const srcL = ctx.createBufferSource()
  srcL.buffer = bufferL
  const gL = ctx.createGain()
  gL.gain.value = gainL
  srcL.connect(gL)
  gL.connect(merger, 0, 0)

  const srcR = ctx.createBufferSource()
  srcR.buffer = bufferR
  const gR = ctx.createGain()
  gR.gain.value = gainR
  srcR.connect(gR)
  gR.connect(merger, 0, 1)

  merger.connect(ctx.destination)

  const startAt = ctx.currentTime + 0.05
  const longer = Math.max(bufferL.duration, bufferR.duration)
  let fired = false
  const fireEnd = () => {
    if (fired) return
    fired = true
    opts.onEnd?.()
  }
  const longerSrc = bufferL.duration >= bufferR.duration ? srcL : srcR
  longerSrc.onended = fireEnd

  srcL.start(startAt)
  srcR.start(startAt)
  // Safety: si onended no dispara (ej. stop temprano)
  const safetyTimer = setTimeout(fireEnd, (0.05 + longer + 0.1) * 1000)

  return () => {
    clearTimeout(safetyTimer)
    try { srcL.stop() } catch { /* ya detenido */ }
    try { srcR.stop() } catch { /* ya detenido */ }
  }
}

/**
 * Reproduce una secuencia de N buffers concatenados en serie, con separación `gap_ms`
 * entre ellos, todos al mismo level_db SPL. Opcionalmente con ruido continuo enmascarante
 * (para Matrix sentence test). `rms_dbfs_per_buffer` permite compensar RMS por palabra.
 * Onend dispara al terminar el último buffer.
 */
export async function playStimulusSequenceWithNoise(
  buffers: AudioBuffer[],
  level_db: number,
  opts: {
    ear?: Ear
    rms_dbfs?: number | null
    refDb?: number
    gap_ms?: number
    noise?: { level_db: number; type: NoiseType } | null
    onEnd?: () => void
  } = {},
): Promise<() => void> {
  if (buffers.length === 0) throw new Error('playStimulusSequenceWithNoise: buffers vacío')
  const ctx = await ensureRunning()
  const ear = opts.ear ?? 'binaural'
  const rms = opts.rms_dbfs ?? -20
  const ref = opts.refDb ?? resolveRefDb(1000, ear)
  const voiceGain = dbToGain(level_db - rms, ref)
  const gapSec = Math.max(0, opts.gap_ms ?? 80) / 1000

  const merger = ctx.createChannelMerger(2)
  const { l, r } = earGains(ear)
  const vL = ctx.createGain(); vL.gain.value = l
  const vR = ctx.createGain(); vR.gain.value = r
  vL.connect(merger, 0, 0); vR.connect(merger, 0, 1)
  merger.connect(ctx.destination)

  const startAt = ctx.currentTime + 0.05
  const leadIn = opts.noise ? 0.2 : 0
  const t0 = startAt + leadIn

  const sources: AudioBufferSourceNode[] = []
  let cursor = t0
  for (const buf of buffers) {
    const src = ctx.createBufferSource()
    src.buffer = buf
    const g = ctx.createGain()
    g.gain.value = voiceGain
    src.connect(g)
    g.connect(vL); g.connect(vR)
    src.start(cursor)
    sources.push(src)
    cursor += buf.duration + gapSec
  }
  const tVoiceEnd = cursor - gapSec
  sources[sources.length - 1].onended = () => opts.onEnd?.()

  let srcN: AudioBufferSourceNode | null = null
  if (opts.noise) {
    const n = opts.noise
    const noiseRef = resolveNoiseRefDb(n.type as NoiseCalibKind, ear)
    const noiseGain = Math.pow(10, (n.level_db - noiseRef) / 20)
    const noiseBuf = (n.type === 'pink' || n.type === 'ssn') ? getPinkNoiseBuffer(ctx) : getWhiteNoiseBuffer(ctx)
    srcN = ctx.createBufferSource()
    srcN.buffer = noiseBuf
    srcN.loop = true
    const gN = ctx.createGain()
    const nL = ctx.createGain(); nL.gain.value = l
    const nR = ctx.createGain(); nR.gain.value = r
    let head: AudioNode = srcN
    if (n.type === 'ssn') {
      const lp = ctx.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = 1000
      lp.Q.value = 0.707
      srcN.connect(lp)
      head = lp
    }
    head.connect(gN); gN.connect(nL); gN.connect(nR)
    nL.connect(merger, 0, 0); nR.connect(merger, 0, 1)
    const tNoiseStart = startAt
    const tNoiseEnd = tVoiceEnd + leadIn
    const fade = 0.05
    gN.gain.setValueAtTime(0, tNoiseStart)
    gN.gain.linearRampToValueAtTime(noiseGain, tNoiseStart + fade)
    gN.gain.setValueAtTime(noiseGain, tNoiseEnd - fade)
    gN.gain.linearRampToValueAtTime(0, tNoiseEnd)
    srcN.start(tNoiseStart)
    srcN.stop(tNoiseEnd + 0.02)
  }

  return () => {
    for (const s of sources) { try { s.stop() } catch {} }
    if (srcN) { try { srcN.stop() } catch {} }
  }
}

let stimulusBufferCache = new Map<string, AudioBuffer>()

export async function loadStimulusBuffer(absPath: string, bytes: Uint8Array): Promise<AudioBuffer> {
  const cached = stimulusBufferCache.get(absPath)
  if (cached) return cached
  const ctx = await ensureRunning()
  const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  const buf = await ctx.decodeAudioData(ab as ArrayBuffer)
  stimulusBufferCache.set(absPath, buf)
  return buf
}

export function clearStimulusCache() {
  stimulusBufferCache = new Map()
}

/**
 * Tono continuo para calibración con sonómetro. gain lineal = 10^(dbfs/20),
 * sin mapeo SPL (no usa dbToGain). Devuelve función stop.
 */
export async function playCalibrationTone(
  frequency: number,
  dbfs: number,
  ear: Ear = 'binaural'
): Promise<() => void> {
  const ctx = await ensureRunning()
  const osc = ctx.createOscillator()
  osc.type = 'sine'
  osc.frequency.value = frequency

  const gain = ctx.createGain()
  gain.gain.value = Math.pow(10, dbfs / 20)

  const merger = ctx.createChannelMerger(2)
  const { l, r } = earGains(ear)
  const leftNode = ctx.createGain()
  const rightNode = ctx.createGain()
  leftNode.gain.value = l
  rightNode.gain.value = r

  osc.connect(gain)
  gain.connect(leftNode)
  gain.connect(rightNode)
  leftNode.connect(merger, 0, 0)
  rightNode.connect(merger, 0, 1)
  merger.connect(ctx.destination)

  osc.start()
  return () => {
    try { osc.stop() } catch {}
  }
}

/**
 * Ruido continuo para calibración SPL del ruido (loop). gain lineal directo = 10^(dbfs/20),
 * sin mapeo SPL. Para SSN aplica LP 1 kHz Q=0.707 (igual que motor de mezcla).
 * Devuelve función stop.
 */
export async function playCalibrationNoise(
  type: NoiseCalibKind,
  dbfs: number,
  ear: Ear = 'binaural',
): Promise<() => void> {
  const ctx = await ensureRunning()
  const buf = (type === 'white') ? getWhiteNoiseBuffer(ctx) : getPinkNoiseBuffer(ctx)
  const src = ctx.createBufferSource()
  src.buffer = buf
  src.loop = true

  const gain = ctx.createGain()
  gain.gain.value = Math.pow(10, dbfs / 20)

  const merger = ctx.createChannelMerger(2)
  const { l, r } = earGains(ear)
  const leftNode = ctx.createGain(); leftNode.gain.value = l
  const rightNode = ctx.createGain(); rightNode.gain.value = r

  let head: AudioNode = src
  if (type === 'ssn') {
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 1000
    lp.Q.value = 0.707
    src.connect(lp)
    head = lp
  }

  head.connect(gain)
  gain.connect(leftNode); gain.connect(rightNode)
  leftNode.connect(merger, 0, 0); rightNode.connect(merger, 0, 1)
  merger.connect(ctx.destination)

  src.start()
  return () => { try { src.stop() } catch {} }
}
