import { ShieldAlert } from 'lucide-react'
import { Link, Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from '@/features/auth'
import type { UserRole } from '@/shared/domain'
import { Button } from '@/shared/ui/button'
import { ErrorState, LoadingState } from '@/shared/ui/page'

export function RequireAuth() {
  const { user, isLoading, loadError, retry, signOut } = useAuth()
  const location = useLocation()

  if (isLoading) return <LoadingState />

  if (loadError) {
    return (
      <div className="mx-auto mt-24 grid max-w-md gap-3 p-4">
        <ErrorState error={loadError} onRetry={retry} />
        <Button variant="ghost" onClick={signOut}>
          Sair
        </Button>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />

  return <Outlet />
}

// Só organiza a navegação: quem garante a permissão é a API
export function RequireRole({ roles }: { roles: UserRole[] }) {
  const { user } = useAuth()

  if (!user || !roles.includes(user.role)) {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-center">
        <ShieldAlert aria-hidden className="size-8 text-muted-foreground" />
        <h1 className="text-xl font-semibold">Acesso negado</h1>
        <p className="max-w-md text-sm text-muted-foreground">O seu perfil de acesso não permite abrir esta página.</p>
        <Button asChild variant="outline">
          <Link to="/">Voltar ao início</Link>
        </Button>
      </div>
    )
  }

  return <Outlet />
}
