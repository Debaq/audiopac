import { useState } from 'react'
import { ChevronDown, ChevronRight, Download, AlertTriangle, Wrench } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface Asset {
  file: string
  label: string
  desc: string
  available: boolean
}

const ASSETS: Asset[] = [
  { file: 'coupler-v1.stl',  label: 'Modelo STL',  desc: 'Imprimir en SLA o FDM',        available: false },
  { file: 'coupler-v1.3mf',  label: 'Modelo 3MF',  desc: 'Con parámetros sugeridos',     available: false },
  { file: 'coupler-v1.step', label: 'CAD STEP',    desc: 'Paramétrico, editable',        available: false },
  { file: 'assembly.pdf',    label: 'Guía de montaje', desc: 'PDF con fotos paso a paso', available: false },
  { file: 'bom.md',          label: 'Lista de materiales', desc: 'O-ring, grout, mic',   available: false },
]

export function CouplerSection() {
  const [open, setOpen] = useState(false)

  return (
    <Card className="mt-4 border-[var(--border)]/60">
      <CardHeader
        className="cursor-pointer select-none"
        onClick={() => setOpen(v => !v)}
      >
        <CardTitle className="flex items-center gap-2 text-base">
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          <Wrench className="w-4 h-4" />
          Coupler DIY (opcional)
          <Badge className="bg-amber-500/80 text-xs">Beta</Badge>
        </CardTitle>
        <CardDescription>
          Adaptador artesanal entre auricular supraaural y sonómetro para
          mejorar repetibilidad de la calibración. Imprimible en 3D.
        </CardDescription>
      </CardHeader>

      {open && (
        <CardContent className="space-y-5">
          <div className="flex gap-3 items-start p-3 rounded-md bg-amber-500/5 border border-amber-500/30">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="text-sm space-y-1">
              <p><strong>No reemplaza acoplador ANSI/IEC certificado.</strong> Uso investigativo / screening.</p>
              <p>Aporta <strong>repetibilidad intra-sujeto</strong> (~±1–2 dB) al fijar la posición auricular-micrófono y sellar la cavidad. Sigue sin cumplir ANSI S3.6 / IEC 60645-1.</p>
            </div>
          </div>

          <div>
            <h3 className="font-medium text-sm mb-2">Archivos descargables</h3>
            <div className="space-y-1.5">
              {ASSETS.map(a => (
                <div
                  key={a.file}
                  className="flex items-center gap-3 p-2 rounded-md bg-[var(--secondary)]"
                >
                  <div className="flex-1">
                    <div className="text-sm font-medium">{a.label}</div>
                    <div className="text-xs text-[var(--muted-foreground)]">{a.desc}</div>
                  </div>
                  {a.available ? (
                    <a
                      href={`/coupler/${a.file}`}
                      download
                      className="inline-flex items-center h-9 px-3 rounded-md text-sm border border-[var(--border)] hover:bg-[var(--accent)]"
                    >
                      <Download className="w-3.5 h-3.5 mr-1.5" />
                      Descargar
                    </a>
                  ) : (
                    <Button size="sm" variant="outline" disabled>
                      Próximamente
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="font-medium text-sm mb-2">Resumen de construcción</h3>
            <ol className="text-sm space-y-2 list-decimal list-inside text-[var(--foreground)]/90">
              <li>
                <strong>Imprimir carcasa</strong>. Preferente SLA (resina) para interior liso.
                FDM alternativa: lijar 600 + epoxi 2 capas en la cavidad interna.
              </li>
              <li>
                <strong>Verificar volumen interno = 6.00 cm³ ± 0.05</strong> (NBS 9-A supraaural)
                llenando con agua antes de sellar. Ajustar con espaciadores si hace falta.
              </li>
              <li>
                <strong>Rellenar camisa externa con grout sin retracción</strong> (no concreto con
                árido grueso). Masa objetivo ~500 g. Aporta amortiguación de vibraciones.
              </li>
              <li>
                <strong>O-ring nitrilo ~50×3 mm</strong> en canal del borde del cojín auricular.
                Garantiza sellado acústico.
              </li>
              <li>
                <strong>Montaje del micrófono</strong>: orificio Ø 12.7 mm (½") para mic clase 2.
                Penetración 3–5 mm hacia la cavidad. Sellado con O-ring 12×2 o roscado.
              </li>
              <li>
                <strong>Posicionamiento estándar</strong>: auricular apoyado con peso de 500 g
                encima (equivalente a la fuerza 4.5 N de IEC).
              </li>
              <li>
                <strong>Offset del coupler</strong>: comparar SPL a 1 kHz en tu coupler vs. campo
                libre con auricular conocido. Registrar offset en las notas de la calibración.
              </li>
            </ol>
          </div>

          <div>
            <h3 className="font-medium text-sm mb-2">Materiales sugeridos</h3>
            <ul className="text-sm space-y-1 text-[var(--muted-foreground)]">
              <li>• Resina SLA estándar o PETG/PLA + epoxi 2K</li>
              <li>• Grout sin retracción (SikaGrout 212 o similar), ~500 g</li>
              <li>• O-ring nitrilo NBR 70 — 50×3 mm (ajustar al cojín)</li>
              <li>• O-ring 12×2 mm para sello del mic</li>
              <li>• Sonómetro clase 2 con mic ½" (GM1352, UT353, XL2 alternativa)</li>
              <li>• Barniz poliuretano (sellar interior FDM)</li>
            </ul>
          </div>
        </CardContent>
      )}
    </Card>
  )
}
