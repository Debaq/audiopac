import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getTemplate } from '@/lib/db/templates'
import { SRTRun } from '@/components/SRTRun'
import { DichoticDigitsRun } from '@/components/DichoticDigitsRun'
import { HINTRun } from '@/components/HINTRun'
import { MatrixRun } from '@/components/MatrixRun'
import { SSWRun } from '@/components/SSWRun'
import { PatternsRun } from '@/components/PatternsRun'
import { buildPreviewPatient, buildPreviewSession } from '@/lib/preview/mockSession'
import type { TestSession, TestTemplateParsed, Patient } from '@/types'

export function PreviewRunPage() {
  const { templateId } = useParams()
  const tid = Number(templateId)

  const [session, setSession] = useState<TestSession | null>(null)
  const [template, setTemplate] = useState<TestTemplateParsed | null>(null)
  const [patient, setPatient] = useState<Patient | null>(null)

  useEffect(() => {
    (async () => {
      const t = await getTemplate(tid)
      if (!t) return
      setTemplate(t)
      setSession(buildPreviewSession(t.id, t.config.channel ?? 'binaural'))
      setPatient(buildPreviewPatient())
    })()
  }, [tid])

  if (!session || !template || !patient) {
    return <div className="p-8">Cargando vista previa...</div>
  }

  const cfg = template.config
  if (cfg.srt) return <SRTRun session={session} template={template} patient={patient} params={cfg.srt} preview />
  if (cfg.dichotic_digits) return <DichoticDigitsRun session={session} template={template} patient={patient} params={cfg.dichotic_digits} preview />
  if (cfg.hint) return <HINTRun session={session} template={template} patient={patient} params={cfg.hint} preview />
  if (cfg.matrix) return <MatrixRun session={session} template={template} patient={patient} params={cfg.matrix} preview />
  if (cfg.ssw) return <SSWRun session={session} template={template} patient={patient} params={cfg.ssw} preview />
  return <PatternsRun session={session} template={template} patient={patient} preview />
}
