import { Suspense, useState } from 'react'
import {
  Bell,
  Building2,
  Cpu,
  LayoutDashboard,
  LogOut,
  Menu,
  QrCode,
  ShieldQuestion,
  Thermometer,
  UserRound,
  Users,
  Warehouse,
  type LucideIcon,
} from 'lucide-react'
import { NavLink, Outlet } from 'react-router'
import { usePendingAlertsCount } from '@/features/alerts'
import { useAuth } from '@/features/auth'
import type { UserRole } from '@/shared/domain'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import { LoadingState } from '@/shared/ui/page'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/shared/ui/sheet'
import { Toaster } from '@/shared/ui/sonner'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
  roles?: UserRole[]
  badge?: 'alerts'
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Visão geral', icon: LayoutDashboard, end: true },
  { to: '/unidades', label: 'Unidades', icon: Warehouse },
  { to: '/alertas', label: 'Alertas', icon: Bell, badge: 'alerts' },
  { to: '/vincular', label: 'Vincular placa', icon: QrCode },
  { to: '/placas', label: 'Placas', icon: Cpu, end: true },
  { to: '/placas/quarentena', label: 'Quarentena', icon: ShieldQuestion },
  { to: '/usuarios', label: 'Usuários', icon: Users, roles: ['ADMIN', 'MASTER'] },
  { to: '/empresas', label: 'Empresas', icon: Building2, roles: ['MASTER'] },
]

function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  const { user, signOut } = useAuth()
  const pendingAlerts = usePendingAlertsCount()

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'flex h-10 items-center gap-2.5 rounded-md px-3 text-sm font-medium transition-colors',
      isActive ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-accent',
    )

  return (
    <div className="flex h-full flex-col gap-1 p-3">
      <nav aria-label="Principal" className="grid gap-1">
        {NAV_ITEMS.filter((item) => !item.roles || (user && item.roles.includes(user.role))).map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end ?? false} onClick={onNavigate} className={linkClass}>
            <item.icon aria-hidden className="size-4" />
            <span className="flex-1">{item.label}</span>
            {item.badge === 'alerts' && pendingAlerts > 0 && (
              <span className="rounded-full bg-status-critical px-1.5 text-xs font-semibold text-white tabular-nums">
                <span className="sr-only">Pendentes: </span>
                {pendingAlerts > 99 ? '99+' : pendingAlerts}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto grid gap-1 border-t pt-3">
        <NavLink to="/perfil" onClick={onNavigate} className={linkClass}>
          <UserRound aria-hidden className="size-4" />
          <span className="truncate">{user?.name ?? 'Meu perfil'}</span>
        </NavLink>
        <Button variant="ghost" className="h-10 justify-start gap-2.5 px-3" onClick={signOut}>
          <LogOut aria-hidden className="size-4" />
          Sair
        </Button>
      </div>
    </div>
  )
}

function Brand() {
  return (
    <span className="flex items-center gap-2 font-semibold">
      <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <Thermometer aria-hidden className="size-4" />
      </span>
      ColdChain
    </span>
  )
}

export function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[15rem_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r bg-card lg:flex">
        <div className="flex h-14 items-center border-b px-4">
          <Brand />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <Navigation />
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-card px-4 lg:hidden">
          <Brand />
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Abrir menu">
                <Menu aria-hidden className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 gap-0 p-0">
              <SheetHeader className="border-b">
                <SheetTitle>ColdChain</SheetTitle>
                <SheetDescription className="sr-only">Menu de navegação</SheetDescription>
              </SheetHeader>
              <div className="min-h-0 flex-1 overflow-y-auto">
                <Navigation onNavigate={() => setMenuOpen(false)} />
              </div>
            </SheetContent>
          </Sheet>
        </header>

        <main className="mx-auto w-full max-w-7xl p-4 md:p-6">
          <Suspense fallback={<LoadingState />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
      <Toaster position="top-right" />
    </div>
  )
}
