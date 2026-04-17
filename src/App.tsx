import { useEffect } from 'react'
import { RouterProvider } from 'react-router-dom'
import { router } from '@/router'
import { useCalibrationStore } from '@/stores/calibration'

function App() {
  const init = useCalibrationStore(s => s.init)
  useEffect(() => init(), [init])
  return <RouterProvider router={router} />
}

export default App
