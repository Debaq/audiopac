export interface RecordedClip {
  buffer: AudioBuffer
  blob: Blob
  mimeType: string
}

export interface ProcessingOptions {
  targetRmsDbfs?: number
  hpHz?: number
  trimSilenceDbfs?: number
  fadeMs?: number
  targetSampleRate?: number
}

export const DEFAULT_PROC: Required<ProcessingOptions> = {
  targetRmsDbfs: -20,
  hpHz: 80,
  trimSilenceDbfs: -45,
  fadeMs: 10,
  targetSampleRate: 44100,
}

export interface StimulusMetrics {
  rms_dbfs: number
  peak_dbfs: number
  duration_ms: number
  sample_rate: number
}

function pickRecordingMime(): string {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus']
  for (const m of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) return m
  }
  return ''
}

export async function startMicRecording(): Promise<{
  stop: () => Promise<RecordedClip>
  cancel: () => void
  getAnalyser: () => AnalyserNode
}> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    },
  })

  const mimeType = pickRecordingMime()
  const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
  const chunks: BlobPart[] = []
  rec.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }
  rec.start()

  const ctx = new AudioContext()
  const src = ctx.createMediaStreamSource(stream)
  const analyser = ctx.createAnalyser()
  analyser.fftSize = 1024
  src.connect(analyser)

  const cleanup = () => {
    stream.getTracks().forEach(t => t.stop())
    ctx.close().catch(() => {})
  }

  return {
    getAnalyser: () => analyser,
    stop: () =>
      new Promise<RecordedClip>((resolve, reject) => {
        rec.onstop = async () => {
          try {
            const blob = new Blob(chunks, { type: mimeType || 'audio/webm' })
            const arr = await blob.arrayBuffer()
            const decodeCtx = new AudioContext()
            const buffer = await decodeCtx.decodeAudioData(arr.slice(0))
            await decodeCtx.close()
            cleanup()
            resolve({ buffer, blob, mimeType: mimeType || 'audio/webm' })
          } catch (e) {
            cleanup()
            reject(e)
          }
        }
        rec.stop()
      }),
    cancel: () => {
      try { rec.stop() } catch {}
      cleanup()
    },
  }
}

function computeRmsDbfs(data: Float32Array): number {
  let sum = 0
  for (let i = 0; i < data.length; i++) sum += data[i] * data[i]
  const rms = Math.sqrt(sum / Math.max(1, data.length))
  if (rms <= 0) return -Infinity
  return 20 * Math.log10(rms)
}

function computePeakDbfs(data: Float32Array): number {
  let peak = 0
  for (let i = 0; i < data.length; i++) {
    const a = Math.abs(data[i])
    if (a > peak) peak = a
  }
  if (peak <= 0) return -Infinity
  return 20 * Math.log10(peak)
}

export function measureBuffer(buf: AudioBuffer): StimulusMetrics {
  const d = buf.getChannelData(0)
  return {
    rms_dbfs: computeRmsDbfs(d),
    peak_dbfs: computePeakDbfs(d),
    duration_ms: Math.round(buf.duration * 1000),
    sample_rate: buf.sampleRate,
  }
}

function findTrimBounds(data: Float32Array, sampleRate: number, thresholdDbfs: number): [number, number] {
  const win = Math.max(1, Math.floor(sampleRate * 0.02))
  const thr = Math.pow(10, thresholdDbfs / 20)
  let start = 0
  let end = data.length
  for (let i = 0; i + win < data.length; i += win) {
    let s = 0
    for (let k = 0; k < win; k++) s += data[i + k] * data[i + k]
    if (Math.sqrt(s / win) > thr) { start = Math.max(0, i - win); break }
  }
  for (let i = data.length - win; i > start; i -= win) {
    let s = 0
    for (let k = 0; k < win; k++) s += data[i + k] * data[i + k]
    if (Math.sqrt(s / win) > thr) { end = Math.min(data.length, i + win * 2); break }
  }
  if (end <= start) return [0, data.length]
  return [start, end]
}

async function resampleMono(buf: AudioBuffer, targetRate: number): Promise<AudioBuffer> {
  if (buf.sampleRate === targetRate && buf.numberOfChannels === 1) return buf
  const length = Math.round(buf.duration * targetRate)
  const off = new OfflineAudioContext(1, length, targetRate)
  const src = off.createBufferSource()
  if (buf.numberOfChannels > 1) {
    const mono = off.createBuffer(1, buf.length, buf.sampleRate)
    const out = mono.getChannelData(0)
    for (let ch = 0; ch < buf.numberOfChannels; ch++) {
      const d = buf.getChannelData(ch)
      for (let i = 0; i < d.length; i++) out[i] += d[i] / buf.numberOfChannels
    }
    src.buffer = mono
  } else {
    src.buffer = buf
  }
  src.connect(off.destination)
  src.start(0)
  return await off.startRendering()
}

async function applyHighpass(buf: AudioBuffer, hz: number): Promise<AudioBuffer> {
  const off = new OfflineAudioContext(1, buf.length, buf.sampleRate)
  const src = off.createBufferSource()
  src.buffer = buf
  const filt = off.createBiquadFilter()
  filt.type = 'highpass'
  filt.frequency.value = hz
  filt.Q.value = 0.707
  src.connect(filt)
  filt.connect(off.destination)
  src.start(0)
  return await off.startRendering()
}

/**
 * Procesa un clip crudo: remuestrea a mono, HP 80 Hz (quita DC y rumble),
 * recorta silencios, aplica fade, normaliza por RMS al target.
 * Devuelve AudioBuffer listo para exportar a WAV.
 */
export async function processClip(
  input: AudioBuffer,
  opts: ProcessingOptions = {},
): Promise<{ buffer: AudioBuffer; metrics: StimulusMetrics }> {
  const o = { ...DEFAULT_PROC, ...opts }

  const resampled = await resampleMono(input, o.targetSampleRate)
  const hpBuf = await applyHighpass(resampled, o.hpHz)

  const srcData = hpBuf.getChannelData(0)
  const [s, e] = findTrimBounds(srcData, hpBuf.sampleRate, o.trimSilenceDbfs)
  const trimmedLen = Math.max(1, e - s)
  const trimmed = new Float32Array(trimmedLen)
  trimmed.set(srcData.subarray(s, e))

  const fadeSamples = Math.min(Math.floor((o.fadeMs / 1000) * hpBuf.sampleRate), Math.floor(trimmedLen / 2))
  for (let i = 0; i < fadeSamples; i++) {
    const g = i / fadeSamples
    trimmed[i] *= g
    trimmed[trimmed.length - 1 - i] *= g
  }

  const currentRms = computeRmsDbfs(trimmed)
  if (Number.isFinite(currentRms)) {
    const deltaDb = o.targetRmsDbfs - currentRms
    let gain = Math.pow(10, deltaDb / 20)
    let peak = 0
    for (let i = 0; i < trimmed.length; i++) {
      const a = Math.abs(trimmed[i])
      if (a > peak) peak = a
    }
    const peakAfter = peak * gain
    if (peakAfter > 0.99) gain *= 0.99 / peakAfter
    for (let i = 0; i < trimmed.length; i++) trimmed[i] *= gain
  }

  const outCtx = new OfflineAudioContext(1, trimmed.length, hpBuf.sampleRate)
  const outBuf = outCtx.createBuffer(1, trimmed.length, hpBuf.sampleRate)
  outBuf.getChannelData(0).set(trimmed)

  return { buffer: outBuf, metrics: measureBuffer(outBuf) }
}

/**
 * Export WAV PCM 16-bit mono.
 */
export function encodeWav(buf: AudioBuffer): Uint8Array {
  const sampleRate = buf.sampleRate
  const channels = 1
  const data = buf.getChannelData(0)
  const bytesPerSample = 2
  const dataSize = data.length * bytesPerSample
  const headerSize = 44
  const out = new ArrayBuffer(headerSize + dataSize)
  const view = new DataView(out)

  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i))
  }

  writeStr(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, channels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * channels * bytesPerSample, true)
  view.setUint16(32, channels * bytesPerSample, true)
  view.setUint16(34, 16, true)
  writeStr(36, 'data')
  view.setUint32(40, dataSize, true)

  let offset = 44
  for (let i = 0; i < data.length; i++) {
    const v = Math.max(-1, Math.min(1, data[i]))
    view.setInt16(offset, v < 0 ? v * 0x8000 : v * 0x7fff, true)
    offset += 2
  }

  return new Uint8Array(out)
}

export async function decodeWavBytes(bytes: Uint8Array): Promise<AudioBuffer> {
  const ctx = new AudioContext()
  const buf = await ctx.decodeAudioData(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength))
  await ctx.close()
  return buf
}
