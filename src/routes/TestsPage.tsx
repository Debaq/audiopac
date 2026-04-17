import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Settings2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { listTemplates, deleteTemplate } from '@/lib/db/templates'
import type { TestTemplateParsed } from '@/types'

export function TestsPage() {
  const [templates, setTemplates] = useState<TestTemplateParsed[]>([])

  const load = async () => setTemplates(await listTemplates(false))
  useEffect(() => { load() }, [])

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm('¿Eliminar este test? Solo se pueden eliminar tests personalizados.')) return
    await deleteTemplate(id)
    await load()
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Tests</h1>
          <p className="text-[var(--muted-foreground)]">Configuraciones de tests disponibles</p>
        </div>
        <Link to="/tests/nuevo">
          <Button><Plus className="w-4 h-4" /> Nuevo test</Button>
        </Link>
      </div>

      <div className="grid gap-3">
        {templates.map(t => (
          <Link key={t.id} to={`/tests/${t.id}`}>
            <Card className="hover:border-[var(--primary)] transition-colors">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] flex items-center justify-center">
                  <Settings2 className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <div className="font-semibold">{t.name}</div>
                    <Badge variant="outline">{t.test_type}</Badge>
                    {t.is_standard ? <Badge variant="secondary">Estándar</Badge> : null}
                  </div>
                  <div className="text-sm text-[var(--muted-foreground)]">{t.description}</div>
                  <div className="text-xs text-[var(--muted-foreground)] mt-1">
                    Práctica: {t.config.practice_sequences.length} • Test: {t.config.test_sequences.length} ítems
                  </div>
                </div>
                {!t.is_standard && (
                  <button
                    onClick={(e) => handleDelete(t.id, e)}
                    className="p-2 rounded-md hover:bg-[var(--destructive)]/10 text-[var(--destructive)]"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
