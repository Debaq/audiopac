import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Download, FileSpreadsheet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getSession, listResponses } from '@/lib/db/sessions'
import { getTemplate } from '@/lib/db/templates'
import { getPatient } from '@/lib/db/patients'
import { getProfile } from '@/lib/db/profiles'
import { generateReportPdf, generateSessionCsv, type ReportData } from '@/lib/pdf/report'
import { formatDateTime, percent, calculateAge, formatDate } from '@/lib/utils'
import { save } from '@tauri-apps/plugin-dialog'
import { writeFile } from '@tauri-apps/plugin-fs'

export function SessionReportPage() {
  const { sessionId } = useParams()
  const sid = Number(sessionId)
  const [data, setData] = useState<ReportData | null>(null)

  useEffect(() => {
    (async () => {
      const s = await getSession(sid)
      if (!s) return
      const [t, p, responses, profile] = await Promise.all([
        getTemplate(s.template_id),
        getPatient(s.patient_id),
        listResponses(sid),
        getProfile(s.profile_id),
      ])
      if (t && p && profile) setData({ session: s, template: t, patient: p, responses, profile })
    })()
  }, [sid])

  const exportPdf = async () => {
    if (!data) return
    const doc = generateReportPdf(data)
    const bytes = doc.output('arraybuffer')
    const suggested = `AudioPAC_${data.patient.last_name}_${data.template.code}_${data.session.id}.pdf`
    const path = await save({ defaultPath: suggested, filters: [{ name: 'PDF', extensions: ['pdf'] }] })
    if (path) {
      await writeFile(path, new Uint8Array(bytes))
    }
  }

  const exportCsv = async () => {
    if (!data) return
    const csv = generateSessionCsv(data)
    const suggested = `AudioPAC_${data.patient.last_name}_${data.template.code}_${data.session.id}.csv`
    const path = await save({ defaultPath: suggested, filters: [{ name: 'CSV', extensions: ['csv'] }] })
    if (path) {
      await writeFile(path, new TextEncoder().encode(csv))
    }
  }

  if (!data) return <div className="p-8">Cargando informe...</div>

  const { session, patient, template, responses, profile } = data
  const testResponses = responses.filter(r => r.phase === 'test')
  const passed = (session.test_score ?? 0) >= 0.75

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <Link to="/informes" className="inline-flex items-center gap-2 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] mb-4">
        <ArrowLeft className="w-4 h-4" /> Volver a informes
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Informe de evaluación</h1>
          <p className="text-[var(--muted-foreground)]">{template.name}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCsv}>
            <FileSpreadsheet className="w-4 h-4" /> CSV
          </Button>
          <Button onClick={exportPdf}>
            <Download className="w-4 h-4" /> Exportar PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Paciente</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1">
            <div className="font-semibold">{patient.last_name}, {patient.first_name}</div>
            {patient.document_id && <div>Doc: {patient.document_id}</div>}
            {patient.birth_date && <div>Nac: {formatDate(patient.birth_date)} ({calculateAge(patient.birth_date)} años)</div>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Sesión</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1">
            <div>Fecha: {formatDateTime(session.started_at)}</div>
            <div>Oído: {session.ear} • Modo: {session.response_mode}</div>
            <div>Evaluador/a: {profile.name}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader><CardTitle>Puntaje</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-[var(--secondary)] rounded-lg">
              <div className="text-xs text-[var(--muted-foreground)]">Práctica</div>
              <div className="text-2xl font-bold">{percent(session.practice_score ?? 0, 1)}%</div>
            </div>
            <div className={`text-center p-4 rounded-lg ${passed ? 'bg-emerald-50 dark:bg-emerald-950/30' : 'bg-red-50 dark:bg-red-950/30'}`}>
              <div className="text-xs text-[var(--muted-foreground)]">Test</div>
              <div className={`text-3xl font-bold ${passed ? 'text-emerald-600' : 'text-red-600'}`}>
                {percent(session.test_score ?? 0, 1)}%
              </div>
              <div className="text-xs">{session.correct_items}/{session.total_items}</div>
            </div>
            <div className="text-center p-4 bg-[var(--secondary)] rounded-lg flex flex-col justify-center">
              <Badge variant={passed ? 'success' : 'destructive'} className="text-sm py-1">
                {passed ? 'DENTRO de norma' : 'BAJO la norma'}
              </Badge>
              <div className="text-xs text-[var(--muted-foreground)] mt-2">Umbral: ≥75%</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {session.notes && (
        <Card className="mb-6">
          <CardHeader><CardTitle>Observaciones</CardTitle></CardHeader>
          <CardContent className="whitespace-pre-wrap text-sm">{session.notes}</CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Detalle por ítem</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="text-left p-2">#</th>
                  <th className="text-left p-2">Esperada</th>
                  <th className="text-left p-2">Respuesta</th>
                  <th className="text-center p-2">Resultado</th>
                  <th className="text-right p-2">RT (ms)</th>
                </tr>
              </thead>
              <tbody>
                {testResponses.map((r, i) => (
                  <tr key={r.id} className="border-b border-[var(--border)]/50">
                    <td className="p-2 text-[var(--muted-foreground)]">{i + 1}</td>
                    <td className="p-2 font-mono font-bold">{r.expected_pattern}</td>
                    <td className="p-2 font-mono">{r.given_pattern ?? '-'}</td>
                    <td className="p-2 text-center">
                      {r.is_correct === 1 ? <span className="text-emerald-600">✓</span> :
                       r.is_correct === 0 ? <span className="text-red-600">✗</span> : '—'}
                    </td>
                    <td className="p-2 text-right font-mono">{r.reaction_time_ms ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
