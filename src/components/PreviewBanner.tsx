import { Eye } from 'lucide-react'

export function PreviewBanner() {
  return (
    <div className="mb-4 rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm flex items-center gap-2 text-amber-800 dark:text-amber-200">
      <Eye className="w-4 h-4 shrink-0" />
      <span>
        <b>Vista previa</b> — sin paciente, sin guardar. Audios faltantes se simulan con un retardo silencioso para recorrer la UI y el informe.
      </span>
    </div>
  )
}
