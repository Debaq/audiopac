import { useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import roadmapRaw from '../../docs/ROADMAP_PAC.md?raw'
import { Card, CardContent } from '@/components/ui/card'
import { CheckCircle2, Clock, ListChecks } from 'lucide-react'

function computeStats(md: string) {
  const done = (md.match(/✅/g) || []).length
  const pending =
    (md.match(/⏳/g) || []).length +
    (md.match(/🚧/g) || []).length +
    (md.match(/\bpendiente\b/gi) || []).length
  const sections = (md.match(/^## /gm) || []).length
  return { done, pending, sections }
}

export function RoadmapPage() {
  const stats = useMemo(() => computeStats(roadmapRaw), [])
  const total = stats.done + stats.pending
  const pct = total > 0 ? Math.round((stats.done / total) * 100) : 0

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-black tracking-tight brand-gradient-text">Roadmap AudioPAC</h1>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">
          Estado del proyecto — lo hecho y lo que falta. Fuente: <code className="text-xs">docs/ROADMAP_PAC.md</code>
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            <div>
              <div className="text-2xl font-bold">{stats.done}</div>
              <div className="text-xs text-[var(--muted-foreground)]">Completado</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Clock className="w-8 h-8 text-amber-500" />
            <div>
              <div className="text-2xl font-bold">{stats.pending}</div>
              <div className="text-xs text-[var(--muted-foreground)]">Pendiente</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <ListChecks className="w-8 h-8 text-[var(--primary)]" />
            <div>
              <div className="text-2xl font-bold">{stats.sections}</div>
              <div className="text-xs text-[var(--muted-foreground)]">Secciones</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-baseline justify-between mb-2">
              <div className="text-2xl font-bold">{pct}%</div>
              <div className="text-xs text-[var(--muted-foreground)]">Progreso</div>
            </div>
            <div className="h-2 bg-[var(--secondary)] rounded-full overflow-hidden">
              <div
                className="h-full brand-gradient transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-6">
          <article className="roadmap-md">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{roadmapRaw}</ReactMarkdown>
          </article>
        </CardContent>
      </Card>
    </div>
  )
}
