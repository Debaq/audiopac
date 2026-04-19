import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Download, FileSpreadsheet, TrendingUp, AlertTriangle, CheckCircle2, Activity, Target, Brain } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getSession, listResponses } from '@/lib/db/sessions'
import { getTemplate } from '@/lib/db/templates'
import { getPatient } from '@/lib/db/patients'
import { getProfile } from '@/lib/db/profiles'
import { generateReportPdf, generateSessionCsv, type ReportData } from '@/lib/pdf/report'
import { formatDateTime, percent, calculateAge, formatDate, cn } from '@/lib/utils'
import { analyzeSession, type SessionAnalysis } from '@/lib/analysis/report'
import {
  getPackForTemplate, pickNormBand, evaluateNorm, bandLabel, deriveMetricValue,
  fillReportTemplate,
  type TemplatePackInfo, type Verdict,
} from '@/lib/packs/interpretation'
import { Markdown, renderInline } from '@/lib/markdown'
import { scoreFromResponses as sswScoreFromResponses } from '@/lib/audio/sswRunner'
import type { SSWScore } from '@/types'
import { save } from '@tauri-apps/plugin-dialog'
import { writeFile } from '@tauri-apps/plugin-fs'

export function SessionReportPage() {
  const { sessionId } = useParams()
  const sid = Number(sessionId)
  const [data, setData] = useState<ReportData | null>(null)
  const [packInfo, setPackInfo] = useState<TemplatePackInfo | null>(null)

  useEffect(() => {
    (async () => {
      const s = await getSession(sid)
      if (!s) return
      const [t, p, responses, profile, pack] = await Promise.all([
        getTemplate(s.template_id),
        getPatient(s.patient_id),
        listResponses(sid),
        getProfile(s.profile_id),
        getPackForTemplate(s.template_id),
      ])
      if (t && p && profile) setData({ session: s, template: t, patient: p, responses, profile })
      setPackInfo(pack)
    })()
  }, [sid])

  const analysis = useMemo<SessionAnalysis | null>(() => {
    if (!data) return null
    return analyzeSession(data.session, data.template, data.responses)
  }, [data])

  const buildFileName = (ext: string) => {
    if (!data) return `AudioPAC.${ext}`
    const slug = (s: string) =>
      s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
    const patientSlug = slug(`${data.patient.last_name}_${data.patient.first_name}`)
    const d = new Date(data.session.started_at)
    const pad = (n: number) => String(n).padStart(2, '0')
    const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`
    return `AudioPAC_${patientSlug}_${dateStr}_${data.template.code}.${ext}`
  }

  const exportPdf = async () => {
    if (!data) return
    const doc = generateReportPdf(data)
    const bytes = doc.output('arraybuffer')
    const path = await save({ defaultPath: buildFileName('pdf'), filters: [{ name: 'PDF', extensions: ['pdf'] }] })
    if (path) await writeFile(path, new Uint8Array(bytes))
  }

  const exportCsv = async () => {
    if (!data) return
    const csv = generateSessionCsv(data)
    const path = await save({ defaultPath: buildFileName('csv'), filters: [{ name: 'CSV', extensions: ['csv'] }] })
    if (path) await writeFile(path, new TextEncoder().encode(csv))
  }

  if (!data || !analysis) return <div className="p-8">Cargando informe...</div>

  const { session, patient, template, responses, profile } = data
  const testResponses = responses.filter(r => r.phase === 'test')
  const { passed, verdict } = analysis

  const verdictMeta = {
    normal: { label: 'DENTRO de norma', color: 'emerald', icon: CheckCircle2 },
    borderline: { label: 'LIMÍTROFE', color: 'amber', icon: AlertTriangle },
    abnormal: { label: 'BAJO la norma', color: 'red', icon: AlertTriangle },
  }[verdict]

  const VerdictIcon = verdictMeta.icon

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <Link to="/informes" className="inline-flex items-center gap-2 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] mb-4">
        <ArrowLeft className="w-4 h-4" /> Volver a informes
      </Link>

      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Informe de evaluación</h1>
          <p className="text-[var(--muted-foreground)]">{template.name} · <span className="uppercase text-xs font-bold">{template.test_type}</span></p>
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

      {/* Encabezado: 3 columnas — paciente, sesión, veredicto */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Paciente</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1">
            <div className="font-bold text-lg">{patient.last_name}, {patient.first_name}</div>
            {patient.document_id && <div className="text-[var(--muted-foreground)]">Doc: {patient.document_id}</div>}
            {patient.birth_date && <div className="text-[var(--muted-foreground)]">Nac: {formatDate(patient.birth_date)} ({calculateAge(patient.birth_date)} años)</div>}
            {patient.gender && <div className="text-[var(--muted-foreground)]">Género: {patient.gender}</div>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Sesión</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1">
            <div><span className="text-[var(--muted-foreground)]">Fecha:</span> {formatDateTime(session.started_at)}</div>
            <div><span className="text-[var(--muted-foreground)]">Oído:</span> <span className="capitalize">{session.ear}</span></div>
            <div><span className="text-[var(--muted-foreground)]">Modo:</span> {session.response_mode}</div>
            <div><span className="text-[var(--muted-foreground)]">Evaluador/a:</span> {profile.name}</div>
          </CardContent>
        </Card>
        <Card className={cn(
          'border-2',
          verdict === 'normal' && 'border-emerald-500/50 bg-emerald-50/40 dark:bg-emerald-950/20',
          verdict === 'borderline' && 'border-amber-500/50 bg-amber-50/40 dark:bg-amber-950/20',
          verdict === 'abnormal' && 'border-red-500/50 bg-red-50/40 dark:bg-red-950/20',
        )}>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><VerdictIcon className={`w-5 h-5 text-${verdictMeta.color}-600`} /> Veredicto</CardTitle></CardHeader>
          <CardContent>
            <Badge variant={passed ? 'success' : 'destructive'} className="text-sm mb-2">
              {verdictMeta.label}
            </Badge>
            <div className={`text-4xl font-black text-${verdictMeta.color}-600`}>
              {percent(session.test_score ?? 0, 1)}%
            </div>
            <div className="text-xs text-[var(--muted-foreground)] mt-1">
              {session.correct_items}/{session.total_items} aciertos · Umbral: ≥{(analysis.threshold * 100).toFixed(0)}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Métricas en 4 columnas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <MetricTile icon={Target} label="Práctica" value={`${percent(analysis.practice.score, 1)}%`} sub={`${analysis.practice.correct}/${analysis.practice.total}`} />
        <MetricTile icon={Activity} label="Δ Práctica→Test" value={`${analysis.practiceToTestDelta >= 0 ? '+' : ''}${(analysis.practiceToTestDelta * 100).toFixed(0)} pp`} tone={analysis.practiceToTestDelta < -0.1 ? 'warn' : 'neutral'} />
        <MetricTile icon={TrendingUp} label="RT medio" value={analysis.test.rt.mean ? `${(analysis.test.rt.mean / 1000).toFixed(2)}s` : '—'} sub={analysis.test.rt.median ? `med ${(analysis.test.rt.median / 1000).toFixed(2)}s` : undefined} />
        <MetricTile icon={Brain} label="Errores parciales" value={`${(analysis.partialMatchRate * 100).toFixed(0)}%`} sub="de los fallos" />
      </div>

      {/* 2 columnas principales: análisis + detalle */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Columna izquierda: Interpretación + patrones */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Brain className="w-5 h-5 text-[var(--primary)]" /> Análisis automático</CardTitle></CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {analysis.interpretation.map((line, i) => (
                  <li key={i} className={cn(
                    'flex gap-2 p-2 rounded-md',
                    i === 0 && verdict === 'normal' && 'bg-emerald-50 dark:bg-emerald-950/30',
                    i === 0 && verdict === 'borderline' && 'bg-amber-50 dark:bg-amber-950/30',
                    i === 0 && verdict === 'abnormal' && 'bg-red-50 dark:bg-red-950/30',
                    i === analysis.interpretation.length - 1 && 'italic text-[var(--muted-foreground)] text-xs',
                  )}>
                    <span className="text-[var(--primary)] font-bold">•</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {analysis.positionErrors.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-base">Acierto por posición</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {analysis.positionErrors.map(p => (
                    <div key={p.index}>
                      <div className="flex justify-between text-xs mb-1">
                        <span>Posición {p.index + 1}</span>
                        <span className="font-mono">{(p.accuracy * 100).toFixed(0)}% ({p.correct}/{p.total})</span>
                      </div>
                      <div className="h-2 bg-[var(--secondary)] rounded-full overflow-hidden">
                        <div className={cn(
                          'h-full rounded-full',
                          p.accuracy >= 0.85 ? 'bg-emerald-500' : p.accuracy >= 0.7 ? 'bg-amber-500' : 'bg-red-500'
                        )} style={{ width: `${p.accuracy * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {analysis.confusions.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-base">Confusiones</CardTitle></CardHeader>
                <CardContent>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-[var(--muted-foreground)] border-b border-[var(--border)]">
                        <th className="text-left py-1">Esperado</th>
                        <th className="text-left py-1">Percibido</th>
                        <th className="text-right py-1">N</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analysis.confusions.slice(0, 5).map((c, i) => (
                        <tr key={i} className="border-b border-[var(--border)]/30">
                          <td className="py-1 font-mono font-bold">{c.from}</td>
                          <td className="py-1 font-mono">→ {c.to}</td>
                          <td className="py-1 text-right font-mono">{c.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Distribución temporal de errores */}
          <Card>
            <CardHeader><CardTitle className="text-base">Distribución de errores</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Inicio', value: analysis.errorDistribution.early },
                  { label: 'Medio', value: analysis.errorDistribution.mid },
                  { label: 'Final', value: analysis.errorDistribution.late },
                ].map(s => (
                  <div key={s.label} className="text-center p-3 bg-[var(--secondary)] rounded-lg">
                    <div className="text-xs text-[var(--muted-foreground)]">{s.label}</div>
                    <div className={cn(
                      'text-2xl font-black',
                      s.value > 0.3 ? 'text-red-600' : s.value > 0.15 ? 'text-amber-600' : 'text-emerald-600'
                    )}>{(s.value * 100).toFixed(0)}%</div>
                    <div className="text-[10px] text-[var(--muted-foreground)]">tasa error</div>
                  </div>
                ))}
              </div>
              <div className="text-xs text-[var(--muted-foreground)] mt-3 text-center">
                Tendencia RT: <span className="font-semibold">{
                  analysis.rtTrend === 'faster' ? 'más rápido →' :
                  analysis.rtTrend === 'slower' ? 'más lento →' :
                  analysis.rtTrend === 'stable' ? 'estable' : 'datos insuficientes'
                }</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Columna derecha: detalle por ítem en columnas compactas */}
        <Card>
          <CardHeader><CardTitle className="text-base">Detalle ítem × ítem</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs font-mono">
              {testResponses.map((r, i) => (
                <div key={r.id} className={cn(
                  'flex items-center justify-between px-2 py-1 rounded border',
                  r.is_correct === 1
                    ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/20'
                    : r.is_correct === 0
                    ? 'border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20'
                    : 'border-[var(--border)]'
                )}>
                  <span className="text-[var(--muted-foreground)]">{i + 1}</span>
                  <div className="flex-1 text-center">
                    <span className="font-bold">{r.expected_pattern}</span>
                    {r.given_pattern && r.given_pattern !== r.expected_pattern && (
                      <span className="text-[var(--muted-foreground)]">→{r.given_pattern}</span>
                    )}
                  </div>
                  <span>
                    {r.is_correct === 1 ? <span className="text-emerald-600">✓</span> :
                     r.is_correct === 0 ? <span className="text-red-600">✗</span> : '—'}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Precisión por patrón (fila completa) */}
      {analysis.patternAccuracy.length > 0 && (
        <Card className="mb-6">
          <CardHeader><CardTitle className="text-base">Precisión por patrón</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {analysis.patternAccuracy.map(p => (
                <div key={p.pattern} className={cn(
                  'p-2 rounded-lg border text-center',
                  p.accuracy >= 0.85 ? 'border-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/20'
                  : p.accuracy >= 0.5 ? 'border-amber-300 bg-amber-50/50 dark:bg-amber-950/20'
                  : 'border-red-300 bg-red-50/50 dark:bg-red-950/20'
                )}>
                  <div className="font-mono font-bold text-sm">{p.pattern}</div>
                  <div className="text-xs text-[var(--muted-foreground)]">{p.correct}/{p.total}</div>
                  <div className="text-xs font-semibold">{(p.accuracy * 100).toFixed(0)}%</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {template.config.ssw && (
        <SSWReportCard responses={data.responses} />
      )}

      {packInfo?.interpretation && (
        <PackNormsCard pack={packInfo} patientAge={calculateAge(patient.birth_date)} testScore={session.test_score ?? null} />
      )}

      {packInfo?.report_template_md && (
        <PackReportTemplateCard
          pack={packInfo}
          template={template.name}
          templateCode={template.code}
          patientName={`${patient.first_name} ${patient.last_name}`}
          patientAge={calculateAge(patient.birth_date)}
          date={formatDateTime(session.started_at)}
          ear={session.ear}
          examiner={profile.name}
          accuracy={session.test_score ?? null}
          correct={session.correct_items ?? 0}
          total={session.total_items ?? 0}
          verdict={verdictMeta.label}
          rtMean={analysis.test.rt.mean}
          rtMedian={analysis.test.rt.median}
          sswScore={template.config.ssw ? sswScoreFromResponses(data.responses.filter(r => r.phase === 'test' || r.phase === 'catch').map(r => ({
            item_index: r.item_index,
            expected_pattern: r.expected_pattern,
            given_pattern: r.given_pattern,
            is_correct: r.is_correct,
            phase: r.phase,
          }))) : null}
        />
      )}

      {session.notes && (
        <Card>
          <CardHeader><CardTitle className="text-base">Observaciones del evaluador</CardTitle></CardHeader>
          <CardContent className="whitespace-pre-wrap text-sm">{session.notes}</CardContent>
        </Card>
      )}
    </div>
  )
}

function PackNormsCard({
  pack, patientAge, testScore,
}: {
  pack: TemplatePackInfo
  patientAge: number | null
  testScore: number | null
}) {
  const interp = pack.interpretation!
  const band = pickNormBand(interp.norms_by_age, patientAge)
  const value = deriveMetricValue(interp.metric, testScore)
  const verdict: Verdict | null = band && value !== null ? evaluateNorm(interp.metric, value, band) : null

  const verdictMeta: Record<Verdict, { label: string; color: string }> = {
    normal: { label: 'Dentro de norma', color: 'emerald' },
    borderline: { label: 'Limítrofe', color: 'amber' },
    abnormal: { label: 'Bajo la norma', color: 'red' },
  }

  const unit = interp.metric === 'accuracy_pct' || interp.metric === 'asymmetry_pct' ? '%'
    : interp.metric === 'srt_db' ? ' dB'
    : interp.metric === 'gap_ms' ? ' ms' : ''

  return (
    <Card className="mb-6 border-[var(--primary)]/30">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2 flex-wrap">
          Normativa clínica — {pack.name}
          <Badge className="text-[10px]">v{pack.version}</Badge>
          {verdict && (
            <Badge className={`text-[10px] bg-${verdictMeta[verdict].color}-600 text-white`}>
              {verdictMeta[verdict].label}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex flex-wrap gap-4 text-xs">
          <div><span className="text-[var(--muted-foreground)]">Métrica:</span> <span className="font-mono">{interp.metric}</span></div>
          {patientAge !== null && <div><span className="text-[var(--muted-foreground)]">Edad paciente:</span> {patientAge} años</div>}
          {band && <div><span className="text-[var(--muted-foreground)]">Banda etaria:</span> {band.age_min}–{band.age_max} años</div>}
          {value !== null && <div><span className="text-[var(--muted-foreground)]">Valor medido:</span> <span className="font-bold">{value.toFixed(1)}{unit}</span></div>}
        </div>

        {band ? (
          <div className="p-2 rounded bg-[var(--secondary)]/50 text-xs">
            <div className="font-semibold mb-1">Umbrales para esta banda</div>
            <div>{bandLabel(interp.metric, band)}</div>
          </div>
        ) : (
          <div className="text-xs text-amber-600 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> Sin norma para esta edad. Interpretación manual requerida.
          </div>
        )}

        {value === null && (
          <div className="text-xs text-[var(--muted-foreground)] italic">
            Métrica "{interp.metric}" no se deriva automáticamente del score global. Interpretar manualmente desde los resultados de la sesión.
          </div>
        )}

        {interp.description_md && (
          <div className="text-xs text-[var(--muted-foreground)] whitespace-pre-wrap leading-relaxed">
            {interp.description_md}
          </div>
        )}

        {pack.references && pack.references.length > 0 && (
          <details className="text-[11px]">
            <summary className="cursor-pointer text-[var(--muted-foreground)] hover:text-[var(--foreground)]">Referencias ({pack.references.length})</summary>
            <ul className="mt-1.5 space-y-1 pl-4 list-disc">
              {pack.references.map((r, i) => (
                <li key={i} className="text-[var(--muted-foreground)]">
                  {renderInline(r.citation)}
                  {r.year && <span> ({r.year})</span>}
                  {r.doi && <> · DOI: <a href={`https://doi.org/${r.doi}`} target="_blank" rel="noreferrer" className="underline">{r.doi}</a></>}
                  {r.url && <> · <a href={r.url} target="_blank" rel="noreferrer" className="underline">link</a></>}
                </li>
              ))}
            </ul>
          </details>
        )}
      </CardContent>
    </Card>
  )
}

function PackReportTemplateCard({
  pack, template, templateCode, patientName, patientAge, date, ear, examiner,
  accuracy, correct, total, verdict, rtMean, rtMedian, sswScore,
}: {
  pack: TemplatePackInfo
  template: string
  templateCode: string
  patientName: string
  patientAge: number | null
  date: string
  ear: string
  examiner: string
  accuracy: number | null
  correct: number
  total: number
  verdict: string
  rtMean: number | null
  rtMedian: number | null
  sswScore?: SSWScore | null
}) {
  const interp = pack.interpretation
  const band = interp ? pickNormBand(interp.norms_by_age, patientAge) : null
  const metricValue = interp ? deriveMetricValue(interp.metric, accuracy) : null
  const accuracyPct = accuracy !== null ? (accuracy * 100).toFixed(1) : null
  const asymmetryPct = interp?.metric === 'asymmetry_pct' && accuracy !== null ? (accuracy * 100).toFixed(1) : null

  const ctx: Record<string, string | number | null> = {
    patient_name: patientName,
    patient_age: patientAge,
    test_name: template,
    test_code: templateCode,
    date,
    ear,
    examiner,
    accuracy_pct: accuracyPct,
    correct,
    total,
    verdict,
    rt_mean_ms: rtMean !== null ? Math.round(rtMean) : null,
    rt_median_ms: rtMedian !== null ? Math.round(rtMedian) : null,
    asymmetry_pct: asymmetryPct,
    srt_db: null,
    metric_value: metricValue !== null ? metricValue.toFixed(1) : null,
    norm_band: band ? `${band.age_min}–${band.age_max}` : null,
    pack_name: pack.name,
    pack_version: pack.version,
    ssw_raw_pct: sswScore ? sswScore.raw_score_pct.toFixed(1) : null,
    ssw_rnc_err: sswScore ? sswScore.by_condition.RNC.error_pct.toFixed(1) : null,
    ssw_rc_err: sswScore ? sswScore.by_condition.RC.error_pct.toFixed(1) : null,
    ssw_lc_err: sswScore ? sswScore.by_condition.LC.error_pct.toFixed(1) : null,
    ssw_lnc_err: sswScore ? sswScore.by_condition.LNC.error_pct.toFixed(1) : null,
    ssw_ear_effect: sswScore ? sswScore.ear_effect_pct.toFixed(1) : null,
    ssw_order_effect: sswScore ? sswScore.order_effect_pct.toFixed(1) : null,
    ssw_reversals: sswScore ? sswScore.reversals : null,
    ssw_verdict: sswScore ? (sswScore.raw_score_pct <= 10 ? 'Normal' : sswScore.raw_score_pct <= 16 ? 'Limítrofe' : 'Bajo norma') : null,
    ssw_catch_correct: sswScore?.catch_correct ?? null,
    ssw_catch_total: sswScore?.catch_total ?? null,
    ssw_catch_accuracy: sswScore?.catch_accuracy_pct !== undefined ? sswScore.catch_accuracy_pct.toFixed(0) : null,
  }

  const filled = fillReportTemplate(pack.report_template_md!, ctx)

  return (
    <Card className="mb-6 border-[var(--primary)]/30">
      <CardHeader><CardTitle className="text-base">Informe narrativo — {pack.name}</CardTitle></CardHeader>
      <CardContent>
        <Markdown source={filled} />
      </CardContent>
    </Card>
  )
}

function SSWReportCard({ responses }: { responses: { item_index: number; expected_pattern: string; given_pattern: string | null; is_correct: number | null; phase: string }[] }) {
  const relevant = responses.filter(r => r.phase === 'test' || r.phase === 'catch').map(r => ({
    item_index: r.item_index,
    expected_pattern: r.expected_pattern,
    given_pattern: r.given_pattern,
    is_correct: r.is_correct,
    phase: r.phase,
  }))
  if (relevant.filter(r => r.phase === 'test').length === 0) return null
  const score = sswScoreFromResponses(relevant)
  const conds: ('RNC' | 'RC' | 'LC' | 'LNC')[] = ['RNC', 'RC', 'LC', 'LNC']
  const verdict = score.raw_score_pct <= 10 ? { label: 'Normal', color: 'emerald' }
    : score.raw_score_pct <= 16 ? { label: 'Limítrofe', color: 'amber' }
    : { label: 'Bajo norma', color: 'red' }

  return (
    <Card className="mb-6 border-[var(--primary)]/30">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          SSW · Staggered Spondaic Word
          <Badge className={`bg-${verdict.color}-600 text-white`}>{verdict.label}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {conds.map(c => {
            const v = score.by_condition[c]
            return (
              <div key={c} className="rounded-lg border p-3 text-center">
                <div className="text-[10px] uppercase text-[var(--muted-foreground)] font-bold">{c}</div>
                <div className="text-2xl font-black mt-1">{v.error_pct.toFixed(1)}%</div>
                <div className="text-xs text-[var(--muted-foreground)]">{v.total - v.correct}/{v.total} err</div>
                <div className="h-1.5 bg-[var(--secondary)] rounded-full mt-1.5 overflow-hidden">
                  <div className={cn('h-full', v.error_pct < 10 ? 'bg-emerald-500' : v.error_pct < 25 ? 'bg-amber-500' : 'bg-red-500')} style={{ width: `${Math.min(100, v.error_pct)}%` }} />
                </div>
              </div>
            )
          })}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
          <div className="rounded-md border p-3">
            <div className="text-xs text-[var(--muted-foreground)]">Raw score</div>
            <div className="text-xl font-black">{score.total_errors}/{score.total_items}</div>
            <div className="text-xs text-[var(--muted-foreground)]">{score.raw_score_pct.toFixed(1)}% errores</div>
          </div>
          <div className="rounded-md border p-3">
            <div className="text-xs text-[var(--muted-foreground)]">Por oído</div>
            <div className="text-xs">R: {score.by_ear.R.errors}/{score.by_ear.R.total}</div>
            <div className="text-xs">L: {score.by_ear.L.errors}/{score.by_ear.L.total}</div>
            <div className="text-xs font-bold mt-1">Ear effect: {score.ear_effect_pct.toFixed(1)}%</div>
          </div>
          <div className="rounded-md border p-3">
            <div className="text-xs text-[var(--muted-foreground)]">Otros</div>
            <div className="text-xs">Order effect: <b>{score.order_effect_pct.toFixed(1)}%</b></div>
            <div className="text-xs">Reversals: <b>{score.reversals}</b></div>
            <div className="text-xs">Bias: <b>{score.response_bias}</b></div>
          </div>
        </div>

        {score.catch_total !== undefined && score.catch_total > 0 && (
          <div className={cn(
            'rounded-md border p-3 text-xs',
            (score.catch_accuracy_pct ?? 0) < 80
              ? 'border-amber-500/50 bg-amber-500/5'
              : 'border-emerald-500/30 bg-emerald-500/5',
          )}>
            <div className="text-[var(--muted-foreground)] mb-1">Catch trials de atención</div>
            <div>
              <b>{score.catch_correct}/{score.catch_total}</b> correctos ·
              <b> {(score.catch_accuracy_pct ?? 0).toFixed(0)}%</b>
              {(score.catch_accuracy_pct ?? 0) < 80 && ' — precisión baja, interpretar con cautela'}
            </div>
          </div>
        )}

        {score.qualifiers.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {score.qualifiers.map(q => (
              <Badge key={q} variant="outline" className="text-[10px]">{q.replace(/_/g, ' ')}</Badge>
            ))}
          </div>
        )}

        <p className="text-[11px] text-[var(--muted-foreground)] italic">
          Cortes indicativos (Katz 1998, 11–60 años): Normal ≤10% · Limítrofe 10–16% · Bajo norma &gt;16%. El pack puede ajustar por edad en &quot;Normativa clínica&quot;.
        </p>
      </CardContent>
    </Card>
  )
}

function MetricTile({
  icon: Icon, label, value, sub, tone = 'neutral',
}: {
  icon: typeof Target
  label: string
  value: string
  sub?: string
  tone?: 'neutral' | 'warn' | 'good'
}) {
  return (
    <div className={cn(
      'rounded-xl p-3 border bg-[var(--card)]',
      tone === 'warn' && 'border-amber-400/60',
      tone === 'good' && 'border-emerald-400/60',
      tone === 'neutral' && 'border-[var(--border)]',
    )}>
      <div className="flex items-center justify-between mb-1">
        <div className="text-[10px] uppercase tracking-wider text-[var(--muted-foreground)] font-bold">{label}</div>
        <Icon className="w-3.5 h-3.5 text-[var(--muted-foreground)]/60" />
      </div>
      <div className="text-xl font-black">{value}</div>
      {sub && <div className="text-[10px] text-[var(--muted-foreground)]">{sub}</div>}
    </div>
  )
}
