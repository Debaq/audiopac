import { useEffect, useState } from 'react'
import { RouterProvider } from 'react-router-dom'
import { router } from '@/router'
import { useCalibrationStore } from '@/stores/calibration'
import { checkSchemaEra, getSetting, type SchemaCheck } from '@/lib/db/client'
import { SchemaIncompatibleDialog } from '@/components/SchemaIncompatibleDialog'
import { BootstrapDialog } from '@/components/BootstrapDialog'

function App() {
  const init = useCalibrationStore(s => s.init)
  const [schema, setSchema] = useState<SchemaCheck | 'loading'>('loading')
  const [bootstrap, setBootstrap] = useState<'loading' | 'needed' | 'done'>('loading')

  useEffect(() => {
    let cancelled = false
    checkSchemaEra().then(async result => {
      if (cancelled) return
      setSchema(result)
      if (result !== 'ok') return
      init()
      const done = await getSetting('bootstrap_done')
      if (cancelled) return
      setBootstrap(done === '1' ? 'done' : 'needed')
    })
    return () => { cancelled = true }
  }, [init])

  if (schema === 'loading') return null
  if (schema === 'incompatible') return <SchemaIncompatibleDialog />
  if (bootstrap === 'loading') return null
  if (bootstrap === 'needed') return <BootstrapDialog onDone={() => setBootstrap('done')} />
  return <RouterProvider router={router} />
}

export default App
