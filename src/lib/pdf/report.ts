import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { TestSession, Patient, TestTemplateParsed, TestResponse, Profile } from '@/types'
import { formatDateTime, formatDate, calculateAge, percent } from '@/lib/utils'

export interface ReportData {
  session: TestSession
  patient: Patient
  template: TestTemplateParsed
  profile: Profile
  responses: TestResponse[]
}

export function generateReportPdf(data: ReportData): jsPDF {
  const { session, patient, template, profile, responses } = data
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.width

  // Header
  doc.setFillColor(107, 31, 46)
  doc.rect(0, 0, pageWidth, 30, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(22)
  doc.text('AudioPAC', 14, 18)
  doc.setFontSize(10)
  doc.text('Informe de Evaluación - Procesamiento Auditivo Central', 14, 25)

  doc.setTextColor(0, 0, 0)
  let y = 42

  // Patient info
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('Datos del paciente', 14, y)
  y += 7
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  const age = calculateAge(patient.birth_date)
  const patientLines = [
    `Nombre: ${patient.last_name}, ${patient.first_name}`,
    patient.document_id ? `Documento: ${patient.document_id}` : '',
    patient.birth_date ? `Fecha nac: ${formatDate(patient.birth_date)}${age !== null ? ` (${age} años)` : ''}` : '',
    patient.gender ? `Género: ${patient.gender}` : '',
  ].filter(Boolean)
  patientLines.forEach(l => { doc.text(l, 14, y); y += 5 })

  // Session info
  y += 5
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('Evaluación', 14, y)
  y += 7
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  const sessionLines = [
    `Test: ${template.name} (${template.test_type})`,
    `Fecha: ${formatDateTime(session.started_at)}`,
    `Oído evaluado: ${earLabel(session.ear)}`,
    `Modo de respuesta: ${session.response_mode}`,
    `Evaluador/a: ${profile.name}`,
  ]
  sessionLines.forEach(l => { doc.text(l, 14, y); y += 5 })

  // Scores
  y += 5
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('Resultados', 14, y)
  y += 7

  const passThreshold = 0.75
  const testScore = session.test_score ?? 0
  const passed = testScore >= passThreshold
  const scoreColor = passed ? [22, 163, 74] : [220, 38, 38]

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`Práctica: ${percent(session.practice_score ?? 0, 1)}%`, 14, y)
  y += 6
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...scoreColor as [number, number, number])
  doc.setFontSize(16)
  doc.text(`TEST: ${percent(testScore, 1)}% (${session.correct_items}/${session.total_items})`, 14, y)
  doc.setTextColor(0, 0, 0)
  y += 8
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`Umbral referencial: ≥${percent(passThreshold, 1)}%  |  Resultado: ${passed ? 'DENTRO de norma' : 'BAJO la norma'}`, 14, y)
  y += 8

  // Detailed table
  const testResponses = responses.filter(r => r.phase === 'test')
  autoTable(doc, {
    startY: y,
    head: [['#', 'Esperada', 'Respuesta', 'Resultado', 'RT (ms)']],
    body: testResponses.map((r, i) => [
      String(i + 1),
      r.expected_pattern,
      r.given_pattern ?? '-',
      r.is_correct === 1 ? '✓' : r.is_correct === 0 ? '✗' : '—',
      r.reaction_time_ms !== null ? String(r.reaction_time_ms) : '—',
    ]),
    theme: 'striped',
    headStyles: { fillColor: [107, 31, 46] },
    styles: { fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 12 },
      1: { cellWidth: 30, fontStyle: 'bold' },
      2: { cellWidth: 30 },
      3: { cellWidth: 20, halign: 'center' },
      4: { cellWidth: 25, halign: 'right' },
    },
  })

  // Notes
  if (session.notes) {
    const afterY = (doc as any).lastAutoTable?.finalY ?? y
    let ny = afterY + 10
    if (ny > 260) { doc.addPage(); ny = 20 }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text('Observaciones', 14, ny); ny += 6
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    const split = doc.splitTextToSize(session.notes, pageWidth - 28)
    doc.text(split, 14, ny)
  }

  // Footer
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(128, 128, 128)
    doc.text(`AudioPAC - Generado: ${formatDateTime(new Date())}  |  Página ${i} de ${pageCount}`, 14, doc.internal.pageSize.height - 8)
  }

  return doc
}

function earLabel(e: string): string {
  return e === 'left' ? 'Izquierdo' : e === 'right' ? 'Derecho' : 'Binaural'
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
