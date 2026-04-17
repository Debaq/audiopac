import { createBrowserRouter } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { AuthGuard } from '@/components/layout/AuthGuard'
import { ProfileSelectorPage } from '@/routes/ProfileSelectorPage'
import { DashboardPage } from '@/routes/DashboardPage'
import { PatientsPage } from '@/routes/PatientsPage'
import { PatientDetailPage } from '@/routes/PatientDetailPage'
import { EvaluationHomePage } from '@/routes/EvaluationHomePage'
import { EvaluationRunPage } from '@/routes/EvaluationRunPage'
import { TestsPage } from '@/routes/TestsPage'
import { TestEditorPage } from '@/routes/TestEditorPage'
import { ReportsPage } from '@/routes/ReportsPage'
import { SessionReportPage } from '@/routes/SessionReportPage'
import { CalibrationPage } from '@/routes/CalibrationPage'
import { StimuliPage } from '@/routes/StimuliPage'

export const router = createBrowserRouter([
  { path: '/', element: <ProfileSelectorPage /> },
  {
    element: <AuthGuard />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/dashboard', element: <DashboardPage /> },
          { path: '/pacientes', element: <PatientsPage /> },
          { path: '/pacientes/:id', element: <PatientDetailPage /> },
          { path: '/evaluacion', element: <EvaluationHomePage /> },
          { path: '/evaluacion/:sessionId', element: <EvaluationRunPage /> },
          { path: '/tests', element: <TestsPage /> },
          { path: '/tests/nuevo', element: <TestEditorPage /> },
          { path: '/tests/:id', element: <TestEditorPage /> },
          { path: '/informes', element: <ReportsPage /> },
          { path: '/informes/:sessionId', element: <SessionReportPage /> },
          { path: '/calibracion', element: <CalibrationPage /> },
          { path: '/estimulos', element: <StimuliPage /> },
        ],
      },
    ],
  },
])
