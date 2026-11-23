import { ShieldQuestion } from 'lucide-react'
import { Link } from 'react-router'
import { useAuth } from '@/features/auth'
import { isAdminRole, type ColdUnitStatus } from '@/shared/domain'
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { EmptyState, ErrorState, LoadingState, PageHeader } from '@/shared/ui/page'
import { UnitCard } from '../components/UnitCard'
import { useDashboardSummary } from '../hooks'

// O que exige atenção aparece primeiro
const STATUS_ORDER: Record<ColdUnitStatus, number> = { OUT_OF_RANGE: 0, NO_SIGNAL: 1, NO_DEVICE: 2, NORMAL: 3 }

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold">{value}</dd>
    </div>
  )
}

export default function DashboardPage() {
  const { user } = useAuth()
  const summary = useDashboardSummary()

  if (summary.isPending) return <LoadingState />
  if (summary.isError && !summary.data) return <ErrorState error={summary.error} onRetry={() => void summary.refetch()} />

  const { totals, units } = summary.data
  const ordered = [...units].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || b.pendingAlerts - a.pendingAlerts)

  return (
    <>
      <PageHeader title="Visão geral"/>

      {summary.isError && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>Não foi possível atualizar. Os dados abaixo podem estar desatualizados.</AlertDescription>
        </Alert>
      )}

      {totals.quarantinedDevices > 0 && (
        <Alert className="mb-4">
          <ShieldQuestion aria-hidden className="size-4" />
          <AlertTitle>
            {totals.quarantinedDevices === 1
              ? '1 placa enviando dados sem vínculo'
              : `${totals.quarantinedDevices} placas enviando dados sem vínculo`}
          </AlertTitle>
          <AlertDescription>
            <p>Os dados ficam retidos por tempo limitado. Vincule a placa para não perdê-los.</p>
            <Button asChild variant="outline" size="sm" className="mt-2">
              <Link to="/placas/quarentena">Ver quarentena</Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <dl className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Normais" value={totals.normal} />
        <Stat label="Fora dos limites" value={totals.outOfRange} />
        <Stat label="Sem sinal ou sem placa" value={totals.noSignal + totals.noDevice} />
        <Stat label="Alertas pendentes" value={totals.pendingAlerts} />
      </dl>

      {units.length === 0 ? (
        <EmptyState
          title="Nenhuma unidade cadastrada"
          description="Cadastre uma câmara, armazém ou caminhão para começar o monitoramento."
          {...(isAdminRole(user?.role)
            ? {
                action: (
                  <Button asChild>
                    <Link to="/unidades">Ir para unidades</Link>
                  </Button>
                ),
              }
            : {})}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {ordered.map((unit) => (
            <UnitCard key={unit.id} unit={unit} />
          ))}
        </div>
      )}
    </>
  )
}
