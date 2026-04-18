import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Play, Package, Edit2, Trash2, BookOpen, Target, Stethoscope,
  Users, AlertTriangle, Clock, ExternalLink, FileText, Video, Link as LinkIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Markdown } from '@/lib/markdown'
import { getTemplateRichMeta, type TemplateRichMeta } from '@/lib/packs/interpretation'
import type { TestTemplateParsed } from '@/types'

function Section({
  icon: Icon, title, children,
}: {
  icon: typeof BookOpen
  title: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2 text-sm font-semibold">
        <Icon className="w-4 h-4 text-[var(--primary)]" />
        {title}
      </div>
      <div className="text-sm text-[var(--foreground)]/90 pl-6">{children}</div>
    </div>
  )
}

const ATTACH_ICON = { pdf: FileText, video: Video, link: LinkIcon }

export function TestDetailPanel({
  template, onDelete, onOpenPack,
}: {
  template: TestTemplateParsed
  onDelete?: () => void
  onOpenPack?: (packCode: string) => void
}) {
  const [rich, setRich] = useState<TemplateRichMeta | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    getTemplateRichMeta(template.id)
      .then(setRich)
      .finally(() => setLoading(false))
  }, [template.id])

  const meta = rich?.test_meta ?? null
  const ageRange = (() => {
    const min = meta?.min_age_years
    const max = meta?.max_age_years
    if (min === undefined && max === undefined) return null
    if (min !== undefined && max !== undefined) return `${min}–${max} años`
    if (min !== undefined) return `≥${min} años`
    return `≤${max} años`
  })()

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-2xl font-bold">{template.name}</h2>
              <Badge variant="outline">{template.test_type}</Badge>
              {template.is_standard ? (
                <Badge variant="secondary">Estándar</Badge>
              ) : (
                <Badge variant="outline">Personalizado</Badge>
              )}
            </div>
            <div className="mt-1 text-xs text-[var(--muted-foreground)] font-mono">{template.code}</div>
            {template.description && (
              <p className="mt-2 text-sm text-[var(--muted-foreground)]">{template.description}</p>
            )}
          </div>
          <div className="flex gap-2 shrink-0">
            <Link to={`/evaluacion?template=${template.id}`}>
              <Button size="sm"><Play className="w-4 h-4" /> Iniciar evaluación</Button>
            </Link>
            <Link to={`/tests/${template.id}`}>
              <Button size="sm" variant="outline"><Edit2 className="w-4 h-4" /> Editar</Button>
            </Link>
            {!template.is_standard && onDelete && (
              <Button size="sm" variant="destructive" onClick={onDelete}>
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {rich && (
            <button
              onClick={() => onOpenPack?.(rich.pack_code)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--secondary)] hover:bg-[var(--secondary)]/80"
            >
              <Package className="w-3.5 h-3.5" />
              {rich.pack_name}
              <ExternalLink className="w-3 h-3" />
            </button>
          )}
          {meta?.family && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--secondary)]">
              {meta.family}
            </span>
          )}
          {ageRange && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--secondary)]">
              <Users className="w-3.5 h-3.5" /> {ageRange}
            </span>
          )}
          {meta?.estimated_duration_min !== undefined && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--secondary)]">
              <Clock className="w-3.5 h-3.5" /> ~{meta.estimated_duration_min} min
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--secondary)]">
            Práctica: {template.config.practice_sequences.length} · Test: {template.config.test_sequences.length}
          </span>
        </div>
      </div>

      <div className="h-px bg-[var(--border)]" />

      {loading ? (
        <div className="text-sm text-[var(--muted-foreground)]">Cargando ficha clínica...</div>
      ) : !meta ? (
        <div className="text-sm text-[var(--muted-foreground)] italic">
          {rich
            ? 'Este test aún no tiene ficha clínica detallada en el pack.'
            : 'Test personalizado sin pack asociado.'}
        </div>
      ) : (
        <div className="space-y-5">
          {meta.purpose_md && (
            <Section icon={Target} title="Para qué sirve">
              <Markdown source={meta.purpose_md} />
            </Section>
          )}
          {meta.how_it_works_md && (
            <Section icon={BookOpen} title="Cómo funciona">
              <Markdown source={meta.how_it_works_md} />
            </Section>
          )}
          {meta.protocol_md && (
            <Section icon={Stethoscope} title="Cómo se realiza">
              <Markdown source={meta.protocol_md} />
            </Section>
          )}
          {meta.target_population_md && (
            <Section icon={Users} title="Qué paciente lo necesita">
              <Markdown source={meta.target_population_md} />
            </Section>
          )}
          {meta.contraindications_md && (
            <Section icon={AlertTriangle} title="Contraindicaciones">
              <Markdown source={meta.contraindications_md} />
            </Section>
          )}
          {meta.references && meta.references.length > 0 && (
            <Section icon={BookOpen} title="Referencias">
              <ul className="list-disc pl-5 space-y-1">
                {meta.references.map((r, i) => (
                  <li key={i}>
                    {r.citation}
                    {r.year && <span className="text-[var(--muted-foreground)]"> ({r.year})</span>}
                    {r.doi && <span className="text-[var(--muted-foreground)]"> · DOI: {r.doi}</span>}
                    {r.url && (
                      <> · <a href={r.url} target="_blank" rel="noreferrer" className="text-[var(--primary)] underline">link</a></>
                    )}
                  </li>
                ))}
              </ul>
            </Section>
          )}
          {meta.attachments && meta.attachments.length > 0 && (
            <Section icon={FileText} title="Material relacionado">
              <ul className="space-y-1">
                {meta.attachments.map((a, i) => {
                  const Icon = ATTACH_ICON[a.kind ?? 'link'] ?? LinkIcon
                  return (
                    <li key={i}>
                      <a href={a.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-[var(--primary)] hover:underline">
                        <Icon className="w-3.5 h-3.5" /> {a.label}
                      </a>
                    </li>
                  )
                })}
              </ul>
            </Section>
          )}
        </div>
      )}
    </div>
  )
}
