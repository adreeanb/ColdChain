import { useState } from 'react'
import { CircleCheck, TriangleAlert, WifiOff } from 'lucide-react'
import { Link } from 'react-router'
import { formatDateTime, formatDuration, formatTemperature } from '@/shared/lib/format'
import { Button } from '@/shared/ui/button'
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/page'
import { Tabs, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { useAlerts, useResolveAlert } from '../hooks'
import type { AlertStatusFilter, TemperatureAlert } from '../types'

const PAGE_SIZE = 20

function AlertDetails({ alert }: { alert: TemperatureAlert }) {
  const parts: string[] = []

  if (alert.device) parts.push(alert.device.macAddress)

  if (alert.type === 'SENSOR_OFFLINE') {
    parts.push(`Sem dados desde ${formatDateTime(alert.startedAt)}`)
  } else {
    if (alert.peakTemperature !== null) parts.push(`Pico de ${formatTemperature(alert.peakTemperature)}`)
    parts.push(alert.readingsCount === 1 ? '1 leitura' : `${alert.readingsCount} leituras`)
    parts.push(`Desde ${formatDateTime(alert.startedAt)}`)
  }

  parts.push(alert.endedAt ? `Durou ${formatDuration(alert.startedAt, alert.endedAt)}` : 'Em andamento')
  if (alert.resolvedAt) parts.push(`Resolvido em ${formatDateTime(alert.resolvedAt)}`)

  return <>{parts.map((part) => ` · ${part}`).join('')}</>
}

export function AlertsPanel({ coldUnitId, filters }: { coldUnitId?: string | undefined; filters?: React.ReactNode }) {
  const [status, setStatus] = useState<AlertStatusFilter>('pending')
  const [page, setPage] = useState(1)
  const [lastFilter, setLastFilter] = useState(coldUnitId)

  // Trocar de unidade volta para a primeira página
  if (lastFilter !== coldUnitId) {
    setLastFilter(coldUnitId)
    setPage(1)
  }

  const alerts = useAlerts({ status, coldUnitId, page, pageSize: PAGE_SIZE })
  const resolve = useResolveAlert()

  const totalPages = alerts.data ? Math.max(1, Math.ceil(alerts.data.total / alerts.data.pageSize)) : 1

  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          value={status}
          onValueChange={(value) => {
            setStatus(value as AlertStatusFilter)
            setPage(1)
          }}
        >
          <TabsList>
            <TabsTrigger value="pending">Pendentes</TabsTrigger>
            <TabsTrigger value="resolved">Resolvidos</TabsTrigger>
          </TabsList>
        </Tabs>
        {filters}
      </div>

      {alerts.isPending ? (
        <LoadingState />
      ) : alerts.isError ? (
        <ErrorState error={alerts.error} onRetry={() => void alerts.refetch()} />
      ) : alerts.data.data.length === 0 ? (
        <EmptyState
          title={status === 'pending' ? 'Nenhum alerta pendente' : 'Nenhum alerta resolvido'}
          {...(status === 'pending' ? { description: 'Tudo certo por aqui.' } : {})}
        />
      ) : (
        <>
          <ul className={`grid gap-2 transition-opacity ${alerts.isPlaceholderData ? 'opacity-60' : ''}`}>
            {alerts.data.data.map((alert) => (
              <li key={alert.id} className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3">
                {alert.resolvedAt ? (
                  <CircleCheck aria-hidden className="size-5 shrink-0 text-status-good" />
                ) : alert.type === 'SENSOR_OFFLINE' ? (
                  <WifiOff aria-hidden className="size-5 shrink-0 text-status-critical" />
                ) : (
                  <TriangleAlert aria-hidden className="size-5 shrink-0 text-status-critical" />
                )}
                <div className="min-w-48 flex-1">
                  <p className="text-sm font-medium">{alert.message}</p>
                  <p className="text-xs text-muted-foreground">
                    <Link to={`/unidades/${alert.coldUnitId}`} className="underline-offset-2 hover:underline">
                      {alert.coldUnit.name}
                    </Link>
                    <AlertDetails alert={alert} />
                  </p>
                </div>
                {!alert.resolvedAt && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={resolve.isPending}
                    onClick={() => resolve.mutate(alert.id)}
                  >
                    Resolver
                  </Button>
                )}
              </li>
            ))}
          </ul>

          <nav aria-label="Paginação" className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
            <span>
              {alerts.data.total === 1 ? '1 alerta' : `${alerts.data.total} alertas`} · página {alerts.data.page} de {totalPages}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                Anterior
              </Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                Próxima
              </Button>
            </div>
          </nav>
        </>
      )}
    </div>
  )
}
