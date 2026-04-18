/**
 * Denoise espectral (spectral gating) por STFT + gate por bin con smoothing
 * temporal y frecuencial. Sin dependencias nativas ni ML. FFT radix-2
 * iterativo (N potencia de 2).
 *
 * Perfil de ruido estimado por percentil bajo de magnitud por bin a través
 * del tiempo — robusto aunque no haya un silencio inicial limpio.
 */

export interface DenoiseOptions {
  fftSize?: number
  hopRatio?: number
  noisePercentile?: number
  gateThresholdDb?: number
  reductionDb?: number
  timeSmoothFrames?: number
  freqSmoothBins?: number
}

export const DEFAULT_DENOISE: Required<DenoiseOptions> = {
  fftSize: 1024,
  hopRatio: 0.25,
  noisePercentile: 0.20,
  gateThresholdDb: 6,
  reductionDb: -12,
  timeSmoothFrames: 2,
  freqSmoothBins: 2,
}

function fftRadix2InPlace(re: Float32Array, im: Float32Array): void {
  const n = re.length
  // bit reversal
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      const tr = re[i]; re[i] = re[j]; re[j] = tr
      const ti = im[i]; im[i] = im[j]; im[j] = ti
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1
    const ang = -2 * Math.PI / len
    const wre = Math.cos(ang)
    const wim = Math.sin(ang)
    for (let i = 0; i < n; i += len) {
      let cre = 1, cim = 0
      for (let j = 0; j < half; j++) {
        const ure = re[i + j]
        const uim = im[i + j]
        const vre = re[i + j + half] * cre - im[i + j + half] * cim
        const vim = re[i + j + half] * cim + im[i + j + half] * cre
        re[i + j] = ure + vre
        im[i + j] = uim + vim
        re[i + j + half] = ure - vre
        im[i + j + half] = uim - vim
        const nre = cre * wre - cim * wim
        cim = cre * wim + cim * wre
        cre = nre
      }
    }
  }
}

function ifftRadix2InPlace(re: Float32Array, im: Float32Array): void {
  const n = re.length
  for (let i = 0; i < n; i++) im[i] = -im[i]
  fftRadix2InPlace(re, im)
  const inv = 1 / n
  for (let i = 0; i < n; i++) { re[i] *= inv; im[i] = -im[i] * inv }
}

function nextPow2(x: number): number {
  let p = 1
  while (p < x) p <<= 1
  return p
}

function percentile(sortedAsc: number[] | Float32Array, p: number): number {
  const n = sortedAsc.length
  if (n === 0) return 0
  const idx = Math.max(0, Math.min(n - 1, Math.floor(n * p)))
  return sortedAsc[idx]
}

export function denoiseSpectral(input: Float32Array, opts: DenoiseOptions = {}): Float32Array {
  const o = { ...DEFAULT_DENOISE, ...opts }
  const N = nextPow2(o.fftSize)
  const hop = Math.max(1, Math.floor(N * o.hopRatio))
  const nBins = (N >> 1) + 1
  const nFrames = Math.floor((input.length - N) / hop) + 1
  if (nFrames < 4) return input.slice()

  // Ventana Hann
  const win = new Float32Array(N)
  for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1))

  // STFT — guarda magnitud y fase por frame
  const mags: Float32Array[] = new Array(nFrames)
  const phases: Float32Array[] = new Array(nFrames)
  const re = new Float32Array(N)
  const im = new Float32Array(N)
  for (let f = 0; f < nFrames; f++) {
    const off = f * hop
    for (let k = 0; k < N; k++) {
      re[k] = input[off + k] * win[k]
      im[k] = 0
    }
    fftRadix2InPlace(re, im)
    const m = new Float32Array(nBins)
    const p = new Float32Array(nBins)
    for (let k = 0; k < nBins; k++) {
      m[k] = Math.hypot(re[k], im[k])
      p[k] = Math.atan2(im[k], re[k])
    }
    mags[f] = m
    phases[f] = p
  }

  // Perfil de ruido: percentil bajo por bin
  const noiseBin = new Float32Array(nBins)
  const col = new Float32Array(nFrames)
  for (let k = 0; k < nBins; k++) {
    for (let f = 0; f < nFrames; f++) col[f] = mags[f][k]
    const sorted = Array.from(col).sort((a, b) => a - b)
    noiseBin[k] = percentile(sorted, o.noisePercentile)
  }

  // Gate mask
  const thrMul = Math.pow(10, o.gateThresholdDb / 20)
  const atten = Math.pow(10, o.reductionDb / 20)
  const masks: Float32Array[] = new Array(nFrames)
  for (let f = 0; f < nFrames; f++) {
    const m = new Float32Array(nBins)
    for (let k = 0; k < nBins; k++) {
      m[k] = mags[f][k] > noiseBin[k] * thrMul ? 1 : atten
    }
    masks[f] = m
  }

  // Smooth en frecuencia (half-width = freqSmoothBins)
  const fsb = Math.max(0, o.freqSmoothBins | 0)
  if (fsb > 0) {
    for (let f = 0; f < nFrames; f++) {
      const sm = new Float32Array(nBins)
      for (let k = 0; k < nBins; k++) {
        let s = 0, c = 0
        const kMin = Math.max(0, k - fsb)
        const kMax = Math.min(nBins - 1, k + fsb)
        for (let kk = kMin; kk <= kMax; kk++) { s += masks[f][kk]; c++ }
        sm[k] = s / c
      }
      masks[f] = sm
    }
  }

  // Smooth en tiempo (half-width = timeSmoothFrames)
  const tsf = Math.max(0, o.timeSmoothFrames | 0)
  if (tsf > 0) {
    const smoothed: Float32Array[] = new Array(nFrames)
    for (let f = 0; f < nFrames; f++) {
      const sm = new Float32Array(nBins)
      for (let k = 0; k < nBins; k++) {
        let s = 0, c = 0
        const fMin = Math.max(0, f - tsf)
        const fMax = Math.min(nFrames - 1, f + tsf)
        for (let ff = fMin; ff <= fMax; ff++) { s += masks[ff][k]; c++ }
        sm[k] = s / c
      }
      smoothed[f] = sm
    }
    for (let f = 0; f < nFrames; f++) masks[f] = smoothed[f]
  }

  // iSTFT con overlap-add y normalización por suma de ventanas^2
  const out = new Float32Array(input.length)
  const norm = new Float32Array(input.length)
  for (let f = 0; f < nFrames; f++) {
    const m = mags[f]
    const p = phases[f]
    const mk = masks[f]
    for (let k = 0; k < nBins; k++) {
      const amp = m[k] * mk[k]
      re[k] = amp * Math.cos(p[k])
      im[k] = amp * Math.sin(p[k])
    }
    // Espejo Hermítico
    for (let k = 1; k < nBins - 1; k++) {
      re[N - k] = re[k]
      im[N - k] = -im[k]
    }
    ifftRadix2InPlace(re, im)
    const off = f * hop
    for (let k = 0; k < N; k++) {
      const idx = off + k
      if (idx < out.length) {
        out[idx] += re[k] * win[k]
        norm[idx] += win[k] * win[k]
      }
    }
  }
  for (let i = 0; i < out.length; i++) {
    if (norm[i] > 1e-8) out[i] /= norm[i]
  }
  return out
}

export async function denoiseBuffer(buf: AudioBuffer, opts: DenoiseOptions = {}): Promise<AudioBuffer> {
  const data = buf.getChannelData(0)
  const out = denoiseSpectral(data, opts)
  const ctx = new OfflineAudioContext(1, out.length, buf.sampleRate)
  const outBuf = ctx.createBuffer(1, out.length, buf.sampleRate)
  outBuf.getChannelData(0).set(out)
  return outBuf
}
