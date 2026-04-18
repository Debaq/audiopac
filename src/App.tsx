import { useEffect, useState } from 'react'
import { RouterProvider } from 'react-router-dom'
import { router } from '@/router'
import { useCalibrationStore } from '@/stores/calibration'
import { checkSchemaEra, type SchemaCheck } from '@/lib/db/client'
import { SchemaIncompatibleDialog } from '@/components/SchemaIncompatibleDialog'

function App() {
  const init = useCalibrationStore(s => s.init)
  const [schema, setSchema] = useState<SchemaCheck | 'loading'>('loading')

  useEffect(() => {
    let cancelled = false
    checkSchemaEra().then(result => {
      if (cancelled) return
      setSchema(result)
      if (result === 'ok') init()
    })
    return () => {
      cancelled = true
    }
  }, [init])

  if (schema === 'loading') return null
  if (schema === 'incompatible') return <SchemaIncompatibleDialog />
  return <RouterProvider router={router} />
}

export default App
