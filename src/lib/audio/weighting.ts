/**
 * Ponderación de sonómetro (A/C/Z) → conversión a dB SPL lineal (Z/flat).
 *
 * Los sonómetros baratos (GM1352, UT353 básicos) solo miden dBA. Clase 2
 * decentes tienen A/C. Clase 1 siempre Z. Para el motor de audio necesitamos
 * dB SPL sin ponderar (Z), así que si el usuario midió con A o C aplicamos
 * el inverso del filtro a la frecuencia medida.
 *
 * Referencia: IEC 61672-1:2013, Tabla 3. Valores tabulados a freqs estándar
 * de tercio de octava; para freqs intermedias interpolamos en log-freq.
 *
 * NOTA: para ruido de banda ancha el offset depende del espectro, no es
 * directamente la tabla. Usamos offsets empíricos aproximados por tipo.
 */
export type Weighting = 'A' | 'C' | 'Z'

// IEC 61672 Tabla 3 — offsets de ponderación A (dB) a freqs estándar.
// dBA = dBZ + A_OFFSET(f). Para convertir A→Z: dBZ = dBA − A_OFFSET(f).
const A_OFFSET: Record<number, number> = {
  10: -70.4, 12.5: -63.4, 16: -56.7, 20: -50.5, 25: -44.7, 31.5: -39.4,
  40: -34.6, 50: -30.2, 63: -26.2, 80: -22.5, 100: -19.1, 125: -16.1,
  160: -13.4, 200: -10.9, 250: -8.6, 315: -6.6, 400: -4.8, 500: -3.2,
  630: -1.9, 800: -0.8, 1000: 0.0, 1250: 0.6, 1600: 1.0, 2000: 1.2,
  2500: 1.3, 3150: 1.2, 4000: 1.0, 5000: 0.5, 6300: -0.1, 8000: -1.1,
  10000: -2.5, 12500: -4.3, 16000: -6.6, 20000: -9.3,
}

// IEC 61672 Tabla 3 — offsets de ponderación C (dB).
const C_OFFSET: Record<number, number> = {
  10: -14.3, 12.5: -11.2, 16: -8.5, 20: -6.2, 25: -4.4, 31.5: -3.0,
  40: -2.0, 50: -1.3, 63: -0.8, 80: -0.5, 100: -0.3, 125: -0.2,
  160: -0.1, 200: 0.0, 250: 0.0, 315: 0.0, 400: 0.0, 500: 0.0,
  630: 0.0, 800: 0.0, 1000: 0.0, 1250: 0.0, 1600: -0.1, 2000: -0.2,
  2500: -0.3, 3150: -0.5, 4000: -0.8, 5000: -1.3, 6300: -2.0, 8000: -3.0,
  10000: -4.4, 12500: -6.2, 16000: -8.5, 20000: -11.2,
}

function interpLogFreq(table: Record<number, number>, freq: number): number {
  const keys = Object.keys(table).map(Number).sort((a, b) => a - b)
  if (freq <= keys[0]) return table[keys[0]]
  if (freq >= keys[keys.length - 1]) return table[keys[keys.length - 1]]
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i], b = keys[i + 1]
    if (freq >= a && freq <= b) {
      const la = Math.log2(a), lb = Math.log2(b), lf = Math.log2(freq)
      const t = (lf - la) / (lb - la)
      return table[a] + t * (table[b] - table[a])
    }
  }
  return 0
}

/**
 * Offset de ponderación (dB) para tono puro a frecuencia dada.
 * dB_weighted = dB_Z + weightingOffset(w, freq).
 */
export function toneWeightingOffset(w: Weighting, freq: number): number {
  if (w === 'Z') return 0
  if (w === 'A') return interpLogFreq(A_OFFSET, freq)
  return interpLogFreq(C_OFFSET, freq)
}

/**
 * Offsets empíricos para ruido de banda ancha. Valores aproximados del
 * promedio ponderado del espectro de cada ruido por el filtro correspondiente.
 * No son de norma — surgen de simulación del filtro A/C sobre el espectro
 * típico del generador. Precisión ~±2 dB vs medición real.
 *
 * Si el usuario tiene sonómetro Z, no aplicamos nada.
 * Si mide con A un ruido pink, dBZ ≈ dBA − NOISE_OFFSET.pink.A
 *
 * Referencia espectro:
 *   - white: plano, dominado por agudos → A pondera poco agudos
 *   - pink: −3 dB/oct, energía distribuida
 *   - ssn (pink LP 1 kHz): energía en graves → A pondera fuerte
 */
const NOISE_OFFSET: Record<'white' | 'pink' | 'ssn', Record<'A' | 'C', number>> = {
  white: { A: -1.5, C: -0.3 },
  pink:  { A: -2.5, C: -0.5 },
  ssn:   { A: -5.5, C: -1.2 },
}

export function noiseWeightingOffset(
  w: Weighting,
  noiseType: 'white' | 'pink' | 'ssn',
): number {
  if (w === 'Z') return 0
  return NOISE_OFFSET[noiseType][w]
}

/** Convierte lectura del sonómetro (con ponderación dada) a dB SPL (Z/flat). */
export function toneToZ(measured: number, w: Weighting, freq: number): number {
  return measured - toneWeightingOffset(w, freq)
}

export function noiseToZ(
  measured: number,
  w: Weighting,
  noiseType: 'white' | 'pink' | 'ssn',
): number {
  return measured - noiseWeightingOffset(w, noiseType)
}

export const WEIGHTING_OPTIONS: { code: Weighting; label: string; hint: string }[] = [
  { code: 'Z', label: 'Z / flat', hint: 'Sin ponderar. Clase 1 o sonómetro con selector "Z/L/flat/lineal".' },
  { code: 'A', label: 'A (dBA)',  hint: 'Más común en sonómetros baratos. Pondera bajas freqs.' },
  { code: 'C', label: 'C (dBC)',  hint: 'Clase 2 con selector A/C. Plano 31.5–8000 Hz.' },
]
