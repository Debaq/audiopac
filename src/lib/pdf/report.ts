import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { TestSession, Patient, TestTemplateParsed, TestResponse, Profile } from '@/types'
import { formatDateTime, formatDate, calculateAge, percent } from '@/lib/utils'
import { analyzeSession } from '@/lib/analysis/report'

export interface ReportData {
  session: TestSession
  patient: Patient
  template: TestTemplateParsed
  profile: Profile
  responses: TestResponse[]
}

const C = {
  primary: [107, 31, 46] as [number, number, number],
  text: [30, 30, 30] as [number, number, number],
  muted: [115, 115, 115] as [number, number, number],
  border: [220, 220, 220] as [number, number, number],
  cardBg: [250, 248, 249] as [number, number, number],
  emerald: [22, 163, 74] as [number, number, number],
  emeraldBg: [220, 252, 231] as [number, number, number],
  amber: [217, 119, 6] as [number, number, number],
  amberBg: [254, 243, 199] as [number, number, number],
  red: [220, 38, 38] as [number, number, number],
  redBg: [254, 226, 226] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
}

const setFill = (doc: jsPDF, c: number[]) => doc.setFillColor(c[0], c[1], c[2])
const setText = (doc: jsPDF, c: number[]) => doc.setTextColor(c[0], c[1], c[2])
const setDraw = (doc: jsPDF, c: number[]) => doc.setDrawColor(c[0], c[1], c[2])

// Reemplaza símbolos que Helvetica/WinAnsi NO soporta y salen como basura.
// Acentos latinos (á é í ó ú ñ ¿ ¡ °) SÍ están en WinAnsi, se dejan.
function asciiSafe(s: string): string {
  return s
    .replace(/[✓✔]/g, 'OK')
    .replace(/[✗✘]/g, 'X')
    .replace(/[—–]/g, '-')
    .replace(/→/g, '->')
    .replace(/←/g, '<-')
    .replace(/[·•]/g, '-')
    .replace(/≥/g, '>=')
    .replace(/≤/g, '<=')
    .replace(/Δ/g, 'd')
    .replace(/[…]/g, '...')
}

function txt(doc: jsPDF, s: string, x: number, y: number, opts?: Parameters<jsPDF['text']>[3]) {
  doc.text(asciiSafe(s), x, y, opts)
}

function drawCard(doc: jsPDF, x: number, y: number, w: number, h: number, opts?: { bg?: number[]; border?: number[] }) {
  setFill(doc, opts?.bg ?? C.cardBg)
  setDraw(doc, opts?.border ?? C.border)
  doc.roundedRect(x, y, w, h, 2, 2, 'FD')
}

function cardLabel(doc: jsPDF, text: string, x: number, y: number) {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  setText(doc, C.muted)
  txt(doc, text.toUpperCase(), x, y)
}

function sectionTitle(doc: jsPDF, text: string, x: number, y: number) {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  setText(doc, C.primary)
  txt(doc, text, x, y)
  setDraw(doc, C.primary)
  doc.setLineWidth(0.5)
  doc.line(x, y + 1.2, x + 30, y + 1.2)
  doc.setLineWidth(0.2)
}

function ensureSpace(doc: jsPDF, y: number, need: number, pageHeight: number): number {
  if (y + need > pageHeight - 14) {
    doc.addPage()
    return 16
  }
  return y
}

export function generateReportPdf(data: ReportData): jsPDF {
  const { session, patient, template, profile, responses } = data
  const analysis = analyzeSession(session, template, responses)
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.width
  const pageHeight = doc.internal.pageSize.height
  const margin = 12
  const contentW = pageWidth - margin * 2

  // ========== HEADER ==========
  setFill(doc, C.primary)
  doc.rect(0, 0, pageWidth, 22, 'F')
  setText(doc, C.white)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(17)
  txt(doc, 'AudioPAC', margin, 11)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  txt(doc, 'Informe de Evaluacion - Procesamiento Auditivo Central', margin, 16.5)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  txt(doc, template.code, pageWidth - margin, 11, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  txt(doc, template.test_type, pageWidth - margin, 16.5, { align: 'right' })

  let y = 28

  // ========== 3 COLUMNAS: PACIENTE | SESION | VEREDICTO ==========
  const col3W = (contentW - 6) / 3
  const headerH = 30
  const age = calculateAge(patient.birth_date)

  drawCard(doc, margin, y, col3W, headerH)
  cardLabel(doc, 'Paciente', margin + 3, y + 5)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10.5)
  setText(doc, C.text)
  txt(doc, `${patient.last_name}, ${patient.first_name}`, margin + 3, y + 11)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  setText(doc, C.muted)
  let py = y + 17
  if (patient.document_id) { txt(doc, `Doc: ${patient.document_id}`, margin + 3, py); py += 4 }
  if (patient.birth_date) { txt(doc, `Nac: ${formatDate(patient.birth_date)}${age !== null ? ` (${age}a)` : ''}`, margin + 3, py); py += 4 }
  if (patient.gender) { txt(doc, `Genero: ${patient.gender}`, margin + 3, py) }

  const col2X = margin + col3W + 3
  drawCard(doc, col2X, y, col3W, headerH)
  cardLabel(doc, 'Sesion', col2X + 3, y + 5)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  let sy = y + 11
  const kv = (k: string, v: string) => {
    setText(doc, C.muted); txt(doc, k, col2X + 3, sy)
    setText(doc, C.text); txt(doc, v, col2X + 20, sy)
    sy += 4.3
  }
  kv('Fecha:', formatDateTime(session.started_at))
  kv('Oido:', earLabel(session.ear))
  kv('Modo:', session.response_mode)
  kv('Evaluador:', profile.name)
  kv('Test:', truncate(template.name, 30))

  const col3X = margin + col3W * 2 + 6
  const verdictBg = analysis.verdict === 'normal' ? C.emeraldBg : analysis.verdict === 'borderline' ? C.amberBg : C.redBg
  const verdictFg = analysis.verdict === 'normal' ? C.emerald : analysis.verdict === 'borderline' ? C.amber : C.red
  drawCard(doc, col3X, y, col3W, headerH, { bg: verdictBg, border: verdictFg })
  cardLabel(doc, 'Veredicto', col3X + 3, y + 5)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  setText(doc, verdictFg)
  const verdictLabel = analysis.verdict === 'normal' ? 'DENTRO de norma' : analysis.verdict === 'borderline' ? 'LIMITROFE' : 'BAJO la norma'
  txt(doc, verdictLabel, col3X + 3, y + 11)
  doc.setFontSize(18)
  txt(doc, `${percent(session.test_score ?? 0, 1)}%`, col3X + 3, y + 20)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  setText(doc, C.muted)
  txt(doc, `${session.correct_items}/${session.total_items}  |  umbral >=${(analysis.threshold * 100).toFixed(0)}%`, col3X + 3, y + 26)

  y += headerH + 3

  // ========== 4 METRICAS ==========
  const m4W = (contentW - 9) / 4
  const mH = 13
  const deltaPP = (analysis.practiceToTestDelta * 100).toFixed(0)
  const metrics = [
    { label: 'Practica', value: `${percent(analysis.practice.score, 1)}%`, sub: `${analysis.practice.correct}/${analysis.practice.total}` },
    { label: 'd Practica-Test', value: `${analysis.practiceToTestDelta >= 0 ? '+' : ''}${deltaPP} pp`, sub: analysis.practiceToTestDelta < -0.1 ? 'caida' : analysis.practiceToTestDelta > 0.15 ? 'mejora' : 'estable' },
    { label: 'RT medio', value: analysis.test.rt.mean ? `${(analysis.test.rt.mean / 1000).toFixed(2)} s` : '-', sub: analysis.test.rt.median ? `med ${(analysis.test.rt.median / 1000).toFixed(2)} s` : '' },
    { label: 'Errores parciales', value: `${(analysis.partialMatchRate * 100).toFixed(0)}%`, sub: 'de los fallos' },
  ]
  metrics.forEach((m, i) => {
    const mx = margin + i * (m4W + 3)
    drawCard(doc, mx, y, m4W, mH)
    cardLabel(doc, m.label, mx + 2.5, y + 4)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10.5)
    setText(doc, C.text)
    txt(doc, m.value, mx + 2.5, y + 9)
    if (m.sub) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(6.5)
      setText(doc, C.muted)
      txt(doc, m.sub, mx + m4W - 2.5, y + 9, { align: 'right' })
    }
  })
  y += mH + 3

  // ========== ANALISIS AUTOMATICO ==========
  y = ensureSpace(doc, y, 25, pageHeight)
  sectionTitle(doc, 'Analisis automatico', margin, y)
  y += 5

  analysis.interpretation.forEach((line, i) => {
    const isLast = i === analysis.interpretation.length - 1
    doc.setFont('helvetica', isLast ? 'italic' : 'normal')
    doc.setFontSize(isLast ? 6.5 : 7.5)
    setText(doc, isLast ? C.muted : C.text)
    const wrapped = doc.splitTextToSize(asciiSafe(line), contentW - 8)
    const blockH = wrapped.length * (isLast ? 3 : 3.3) + 0.5
    y = ensureSpace(doc, y, blockH, pageHeight)
    if (i === 0) {
      setFill(doc, verdictBg)
      doc.roundedRect(margin, y - 2, contentW, blockH + 1, 1, 1, 'F')
    }
    setText(doc, C.primary)
    doc.setFont('helvetica', 'bold')
    txt(doc, '-', margin + 2, y + 1)
    doc.setFont('helvetica', isLast ? 'italic' : 'normal')
    setText(doc, isLast ? C.muted : C.text)
    doc.text(wrapped, margin + 6, y + 1)
    y += blockH
  })
  y += 1

  // ========== 2 COL: POSICION | CONFUSIONES ==========
  const twoColW = (contentW - 5) / 2
  if (analysis.positionErrors.length > 0) {
    const needH = 8 + analysis.positionErrors.length * 4.5
    y = ensureSpace(doc, y, needH, pageHeight)
    const startY = y

    sectionTitle(doc, 'Acierto por posicion', margin, y)
    let ly = y + 4
    analysis.positionErrors.forEach(p => {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      setText(doc, C.text)
      txt(doc, `Pos. ${p.index + 1}`, margin, ly)
      setText(doc, C.muted)
      txt(doc, `${(p.accuracy * 100).toFixed(0)}% (${p.correct}/${p.total})`, margin + twoColW, ly, { align: 'right' })
      const barY = ly + 0.5
      setFill(doc, [230, 230, 230])
      doc.roundedRect(margin, barY, twoColW - 1, 1.4, 0.6, 0.6, 'F')
      const color = p.accuracy >= 0.85 ? C.emerald : p.accuracy >= 0.7 ? C.amber : C.red
      setFill(doc, color)
      doc.roundedRect(margin, barY, (twoColW - 1) * p.accuracy, 1.4, 0.6, 0.6, 'F')
      ly += 4.5
    })

    if (analysis.confusions.length > 0) {
      const rx = margin + twoColW + 5
      sectionTitle(doc, 'Confusiones', rx, startY)
      let ry = startY + 4
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(6.5)
      setText(doc, C.muted)
      txt(doc, 'Esp', rx, ry)
      txt(doc, 'Perc', rx + 15, ry)
      txt(doc, 'N', rx + twoColW - 2, ry, { align: 'right' })
      setDraw(doc, C.border)
      doc.line(rx, ry + 0.8, rx + twoColW - 1, ry + 0.8)
      ry += 3.5
      analysis.confusions.slice(0, 6).forEach(c => {
        doc.setFont('courier', 'bold')
        doc.setFontSize(7)
        setText(doc, C.text)
        txt(doc, c.from, rx, ry)
        doc.setFont('courier', 'normal')
        txt(doc, `-> ${c.to}`, rx + 15, ry)
        doc.setFont('helvetica', 'bold')
        txt(doc, String(c.count), rx + twoColW - 2, ry, { align: 'right' })
        ry += 3.5
      })
    }

    y = ly + 1
  }

  // ========== DISTRIBUCION ERRORES (compacto, una fila con 3 tiles + tendencia) ==========
  y = ensureSpace(doc, y, 15, pageHeight)
  sectionTitle(doc, 'Distribucion temporal de errores', margin, y)
  y += 4
  const segW = (contentW - 6) / 3
  const segs = [
    { label: 'Inicio', value: analysis.errorDistribution.early },
    { label: 'Medio', value: analysis.errorDistribution.mid },
    { label: 'Final', value: analysis.errorDistribution.late },
  ]
  segs.forEach((s, i) => {
    const sx = margin + i * (segW + 3)
    const bgc = s.value > 0.3 ? C.redBg : s.value > 0.15 ? C.amberBg : C.emeraldBg
    const fg = s.value > 0.3 ? C.red : s.value > 0.15 ? C.amber : C.emerald
    drawCard(doc, sx, y, segW, 10, { bg: bgc, border: fg })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.5)
    setText(doc, C.muted)
    txt(doc, s.label, sx + 2, y + 3.5)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    setText(doc, fg)
    txt(doc, `${(s.value * 100).toFixed(0)}%`, sx + 2, y + 8.5)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6)
    setText(doc, C.muted)
    txt(doc, 'tasa error', sx + segW - 2, y + 8.5, { align: 'right' })
  })
  y += 11
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  setText(doc, C.muted)
  const trendLabel = analysis.rtTrend === 'faster' ? 'mas rapido con el tiempo' : analysis.rtTrend === 'slower' ? 'mas lento con el tiempo' : analysis.rtTrend === 'stable' ? 'estable' : 'datos insuficientes'
  txt(doc, `Tendencia RT: ${trendLabel}`, margin, y)
  y += 3

  // ========== PRECISION POR PATRON ==========
  if (analysis.patternAccuracy.length > 0) {
    y = ensureSpace(doc, y, 14, pageHeight)
    sectionTitle(doc, 'Precision por patron', margin, y)
    y += 4
    const cellsPerRow = 12
    const cellW = (contentW - (cellsPerRow - 1) * 1.2) / cellsPerRow
    const cellH = 9
    analysis.patternAccuracy.forEach((p, i) => {
      if (i > 0 && i % cellsPerRow === 0) {
        y += cellH + 1.2
        y = ensureSpace(doc, y, cellH, pageHeight)
      }
      const col = i % cellsPerRow
      const cx = margin + col * (cellW + 1.2)
      const bg = p.accuracy >= 0.85 ? C.emeraldBg : p.accuracy >= 0.5 ? C.amberBg : C.redBg
      const fg = p.accuracy >= 0.85 ? C.emerald : p.accuracy >= 0.5 ? C.amber : C.red
      drawCard(doc, cx, y, cellW, cellH, { bg, border: fg })
      doc.setFont('courier', 'bold')
      doc.setFontSize(6.5)
      setText(doc, C.text)
      txt(doc, p.pattern, cx + cellW / 2, y + 3, { align: 'center' })
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(6.5)
      setText(doc, fg)
      txt(doc, `${(p.accuracy * 100).toFixed(0)}%`, cx + cellW / 2, y + 6.3, { align: 'center' })
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(5.5)
      setText(doc, C.muted)
      txt(doc, `${p.correct}/${p.total}`, cx + cellW / 2, y + 8.3, { align: 'center' })
    })
    y += cellH + 3
  }

  // ========== DETALLE ITEM (3 COLUMNAS PAREADAS) ==========
  const testResponses = responses.filter(r => r.phase === 'test')
  y = ensureSpace(doc, y, 20, pageHeight)
  sectionTitle(doc, 'Detalle item por item', margin, y)
  y += 2

  const nCols = 3
  const chunk = Math.ceil(testResponses.length / nCols)
  const pairedRows: string[][] = []
  for (let i = 0; i < chunk; i++) {
    const row: string[] = []
    for (let c = 0; c < nCols; c++) {
      const idx = i + c * chunk
      const r = testResponses[idx]
      if (r) {
        row.push(
          String(idx + 1),
          r.expected_pattern,
          r.given_pattern ?? '-',
          r.is_correct === 1 ? 'OK' : r.is_correct === 0 ? 'X' : '-',
          r.reaction_time_ms !== null ? String(r.reaction_time_ms) : '-',
        )
      } else {
        row.push('', '', '', '', '')
      }
    }
    pairedRows.push(row)
  }

  const headRow: string[] = []
  for (let c = 0; c < nCols; c++) headRow.push('#', 'Esp', 'Resp', 'R', 'RT')

  const colStyles: Record<number, any> = {}
  for (let c = 0; c < nCols; c++) {
    const base = c * 5
    colStyles[base + 0] = { cellWidth: 5, halign: 'center', textColor: C.muted }
    colStyles[base + 1] = { cellWidth: 13, fontStyle: 'bold', font: 'courier', halign: 'center' }
    colStyles[base + 2] = { cellWidth: 13, font: 'courier', halign: 'center' }
    colStyles[base + 3] = { cellWidth: 5, halign: 'center', fontStyle: 'bold' }
    colStyles[base + 4] = { cellWidth: 10, halign: 'right', font: 'courier' }
  }

  autoTable(doc, {
    startY: y + 1,
    head: [headRow],
    body: pairedRows,
    theme: 'grid',
    headStyles: { fillColor: C.primary, textColor: C.white, fontStyle: 'bold', fontSize: 6.5, halign: 'center', cellPadding: 0.6 },
    bodyStyles: { fontSize: 6.5, textColor: C.text, cellPadding: 0.5 },
    alternateRowStyles: { fillColor: [252, 250, 250] },
    styles: { cellPadding: 0.5, lineColor: C.border, lineWidth: 0.08 },
    columnStyles: colStyles,
    didParseCell: (hookData) => {
      if (hookData.section === 'body') {
        const resultCols = Array.from({ length: nCols }, (_, c) => c * 5 + 3)
        if (resultCols.includes(hookData.column.index)) {
          const v = hookData.cell.raw
          if (v === 'OK') hookData.cell.styles.textColor = C.emerald
          if (v === 'X') hookData.cell.styles.textColor = C.red
        }
      }
    },
    margin: { left: margin, right: margin },
  })

  let afterY = (doc as any).lastAutoTable?.finalY ?? y

  // ========== OBSERVACIONES ==========
  if (session.notes) {
    afterY += 4
    afterY = ensureSpace(doc, afterY, 15, pageHeight)
    sectionTitle(doc, 'Observaciones del evaluador', margin, afterY)
    afterY += 3
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    setText(doc, C.text)
    const split = doc.splitTextToSize(asciiSafe(session.notes), contentW - 4)
    setFill(doc, C.cardBg)
    setDraw(doc, C.border)
    const boxH = split.length * 3.5 + 4
    doc.roundedRect(margin, afterY - 1.5, contentW, boxH, 1, 1, 'FD')
    doc.text(split, margin + 3, afterY + 1.5)
    afterY += boxH
  }

  // ========== FIRMA PROFESIONAL ==========
  afterY += 8
  afterY = ensureSpace(doc, afterY, 28, pageHeight)
  const signW = 70
  const signX = (pageWidth - signW) / 2
  setDraw(doc, C.text)
  doc.setLineWidth(0.3)
  doc.line(signX, afterY + 16, signX + signW, afterY + 16)
  doc.setLineWidth(0.2)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  setText(doc, C.text)
  txt(doc, profile.name, signX + signW / 2, afterY + 20, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  setText(doc, C.muted)
  txt(doc, 'Firma y timbre profesional', signX + signW / 2, afterY + 24, { align: 'center' })

  // ========== FOOTER ==========
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    setDraw(doc, C.border)
    doc.setLineWidth(0.2)
    doc.line(margin, pageHeight - 9, pageWidth - margin, pageHeight - 9)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    setText(doc, C.muted)
    txt(doc, `AudioPAC  |  ${patient.last_name}, ${patient.first_name}  |  ${template.code}`, margin, pageHeight - 5)
    txt(doc, `Generado ${formatDateTime(new Date())}`, pageWidth / 2, pageHeight - 5, { align: 'center' })
    txt(doc, `Pag. ${i}/${pageCount}`, pageWidth - margin, pageHeight - 5, { align: 'right' })
  }

  return doc
}

function earLabel(e: string): string {
  return e === 'left' ? 'Izquierdo' : e === 'right' ? 'Derecho' : 'Binaural'
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '...' : s
}

export function generateSessionCsv(data: ReportData): string {
  const { session, patient, template, responses } = data
  const headers = ['session_id', 'patient_id', 'patient_name', 'template', 'test_type', 'ear', 'phase', 'item_index', 'expected', 'given', 'correct', 'rt_ms', 'started_at']
  const rows = responses.map(r => [
    session.id,
    patient.id,
    `${patient.last_name}, ${patient.first_name}`,
    template.code,
    template.test_type,
    session.ear,
    r.phase,
    r.item_index,
    r.expected_pattern,
    r.given_pattern ?? '',
    r.is_correct === null ? '' : (r.is_correct ? '1' : '0'),
    r.reaction_time_ms ?? '',
    session.started_at,
  ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
  return [headers.join(','), ...rows].join('\n')
}
