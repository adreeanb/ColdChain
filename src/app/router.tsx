import { lazy, Suspense } from 'react'
import { createBrowserRouter, Link } from 'react-router'
import { Button } from '@/shared/ui/button'
import { LoadingState } from '@/shared/ui/page'
import { AppLayout } from './AppLayout'
import { RequireAuth, RequireRole } from './guards'

const LoginPage = lazy(() => import('@/features/auth/pages/LoginPage'))
const ProfilePage = lazy(() => import('@/features/auth/pages/ProfilePage'))
const DashboardPage = lazy(() => import('@/features/dashboard/pages/DashboardPage'))
const ColdUnitsPage = lazy(() => import('@/features/cold-units/pages/ColdUnitsPage'))
const ColdUnitDetailPage = lazy(() => import('@/features/cold-units/pages/ColdUnitDetailPage'))
const AlertsPage = lazy(() => import('@/features/alerts/pages/AlertsPage'))
const BindDevicePage = lazy(() => import('@/features/devices/pages/BindDevicePage'))
const DevicesPage = lazy(() => import('@/features/devices/pages/DevicesPage'))
const DeviceDetailPage = lazy(() => import('@/features/devices/pages/DeviceDetailPage'))
const QuarantinePage = lazy(() => import('@/features/devices/pages/QuarantinePage'))
const UsersPage = lazy(() => import('@/features/users/pages/UsersPage'))
const EnterprisesPage = lazy(() => import('@/features/enterprises/pages/EnterprisesPage'))
const EnterpriseDetailPage = lazy(() => import('@/features/enterprises/pages/EnterpriseDetailPage'))

function NotFoundPage() {
  return (
    <div className="flex flex-col items-center gap-3 py-20 text-center">
      <h1 className="text-xl font-semibold">Página não encontrada</h1>
      <Button asChild variant="outline">
        <Link to="/">Voltar ao início</Link>
      </Button>
    </div>
  )
}

export const router = createBrowserRouter([
  {
    path: '/login',
    element: (
      <Suspense fallback={<LoadingState />}>
        <LoginPage />
      </Suspense>
    ),
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: 'unidades', element: <ColdUnitsPage /> },
          { path: 'unidades/:id', element: <ColdUnitDetailPage /> },
          { path: 'alertas', element: <AlertsPage /> },
          { path: 'vincular', element: <BindDevicePage /> },
          { path: 'placas', element: <DevicesPage /> },
          { path: 'placas/quarentena', element: <QuarantinePage /> },
          { path: 'placas/:id', element: <DeviceDetailPage /> },
          { path: 'perfil', element: <ProfilePage /> },
          {
            element: <RequireRole roles={['ADMIN', 'MASTER']} />,
            children: [{ path: 'usuarios', element: <UsersPage /> }],
          },
          {
            element: <RequireRole roles={['MASTER']} />,
            children: [
              { path: 'empresas', element: <EnterprisesPage /> },
              { path: 'empresas/:id', element: <EnterpriseDetailPage /> },
            ],
          },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
])
