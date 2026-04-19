import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getSession } from '@/lib/db/sessions'
import { getTemplate } from '@/lib/db/templates'
import { getPatient } from '@/lib/db/patients'
import { SRTRun } from '@/components/SRTRun'
import { DichoticDigitsRun } from '@/components/DichoticDigitsRun'
import { HINTRun } from '@/components/HINTRun'
import { MatrixRun } from '@/components/MatrixRun'
import { SSWRun } from '@/components/SSWRun'
import { PatternsRun } from '@/components/PatternsRun'
import type { TestSession, TestTemplateParsed, Patient } from '@/types'

export function EvaluationRunPage() {
  const { sessionId } = useParams()
  const sid = Number(sessionId)

  const [session, setSession] = useState<TestSession | null>(null)
  const [template, setTemplate] = useState<TestTemplateParsed | null>(null)
  const [patient, setPatient] = useState<Patient | null>(null)

  useEffect(() => {
    (async () => {
      const s = await getSession(sid)
      if (!s) return
      setSession(s)
      const [t, p] = await Promise.all([getTemplate(s.template_id), getPatient(s.patient_id)])
      setTemplate(t)
      setPatient(p)
    })()
  }, [sid])

  if (!session || !template || !patient) {
    return <div className="p-8">Cargando evaluación...</div>
  }

  const cfg = template.config
  if (cfg.srt) return <SRTRun session={session} template={template} patient={patient} params={cfg.srt} />
  if (cfg.dichotic_digits) return <DichoticDigitsRun session={session} template={template} patient={patient} params={cfg.dichotic_digits} />
  if (cfg.hint) return <HINTRun session={session} template={template} patient={patient} params={cfg.hint} />
  if (cfg.matrix) return <MatrixRun session={session} template={template} patient={patient} params={cfg.matrix} />
  if (cfg.ssw) return <SSWRun session={session} template={template} patient={patient} params={cfg.ssw} />
  return <PatternsRun session={session} template={template} patient={patient} />
}
