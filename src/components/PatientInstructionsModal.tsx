import { Play, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Markdown } from '@/lib/markdown'

interface Props {
  title?: string
  instructions_md: string
  onStart: () => void
  onClose: () => void
  startLabel?: string
}

export function PatientInstructionsModal({ title, instructions_md, onStart, onClose, startLabel }: Props) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-[var(--card)] rounded-2xl p-6 w-full max-w-2xl shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold">{title ?? 'Consigna al paciente'}</h3>
          <button onClick={onClose} className="p-1 hover:bg-[var(--secondary)] rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="max-h-[55vh] overflow-y-auto pr-1 text-sm">
          <Markdown source={instructions_md} />
        </div>
        <div className="flex gap-2 justify-end mt-5">
          <Button variant="outline" onClick={onClose}>Cerrar</Button>
          <Button onClick={onStart}>
            <Play className="w-4 h-4" /> {startLabel ?? 'Entendido, iniciar'}
          </Button>
        </div>
      </div>
    </div>
  )
}
