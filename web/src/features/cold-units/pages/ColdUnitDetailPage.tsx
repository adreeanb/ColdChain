import { useState } from 'react'
import { ArrowLeft, Pencil, QrCode, Trash2, Wifi, WifiOff } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router'
import { AlertsPanel } from '@/features/alerts'
import { useAuth } from '@/features/auth'
import { useDashboardSummary, type UnitSummary } from '@/features/dashboard'
import { COLD_UNIT_TYPE_LABELS, isAdminRole } from '@/shared/domain'
import { formatDateTime, formatFullDateTime, formatRelative, formatTemperature } from '@/shared/lib/format'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { ConfirmDialog } from '@/shared/ui/confirm-dialog'
import { NativeSelect } from '@/shared/ui/form'
import { Label } from '@/shared/ui/label'
import { EmptyState, ErrorState, LoadingState, PageHeader } from '@/shared/ui/page'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { UnitStatusBadge } from '@/shared/ui/unit-status-badge'
import { ColdUnitFormDialog } from '../components/ColdUnitFormDialog'
import { TemperatureChart } from '../components/TemperatureChart'
import { useDeleteColdUnit, useReadings, useUnbindFromUnit, useUnitAssociations } from '../hooks'

function ReadingsTab({ unit }: { unit: UnitSummary }) {
  const [deviceId, setDeviceId] = useState('')
  const readings = useReadings(unit.id, deviceId || undefined)

  const associations = useUnitAssociations(unit.id)
  const devices = new Map(associations.data?.map((item) => [item.device.id, item.device.macAddress]))

  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Label htmlFor="device-filter">Placa</Label>
        <div className="w-56">
          <NativeSelect id="device-filter" value={deviceId} onChange={(event) => setDeviceId(event.target.value)}>
            <option value="">Todas</option>
            {[...devices].map(([id, macAddress]) => (
              <option key={id} value={id}>
                {macAddress}
              </option>
            ))}
          </NativeSelect>
        </div>
        <span className="text-xs text-muted-foreground">Últimas 100 leituras</span>
      </div>

      {readings.isPending ? (
        <LoadingState />
      ) : readings.isError && !readings.data ? (
        <ErrorState error={readings.error} onRetry={() => void readings.refetch()} />
      ) : readings.data.length === 0 ? (
        <EmptyState title="Nenhuma leitura registrada" />
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Horário da leitura</TableHead>
                <TableHead className="text-right">Temperatura</TableHead>
                <TableHead>Placa</TableHead>
                <TableHead>Origem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {readings.data.map((reading) => {
                const outOfRange = reading.temperature < unit.minTemperature || reading.temperature > unit.maxTemperature
                return (
                  <TableRow key={reading.id}>
                    <TableCell className="tabular-nums">{formatFullDateTime(reading.timestamp)}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatTemperature(reading.temperature)}
                      {outOfRange && <span className="ml-1.5 text-xs font-normal text-muted-foreground">fora da faixa</span>}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{reading.device.macAddress}</TableCell>
                    <TableCell>{reading.sourceType === 'HISTORICAL' ? <Badge variant="secondary">Recuperada</Badge> : 'Tempo real'}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

function DevicesTab({ unit }: { unit: UnitSummary }) {
  const associations = useUnitAssociations(unit.id)
  const unbind = useUnbindFromUnit(unit.id)

  return (
    <div className="grid grid-cols-1 gap-6">
      <section className="grid grid-cols-1 gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-medium">Placas ativas</h2>
          <Button asChild size="sm">
            <Link to={`/vincular?unidade=${unit.id}`}>
              <QrCode aria-hidden />
              Vincular placa
            </Link>
          </Button>
        </div>
        {unit.devices.length === 0 ? (
          <EmptyState title="Nenhuma placa vinculada" description="Sem placa, esta unidade não recebe leituras." />
        ) : (
          <ul className="grid grid-cols-1 gap-2">
            {unit.devices.map((device) => (
              <li key={device.id} className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3">
                {device.isOnline ? (
                  <Wifi aria-hidden className="size-4 text-status-good" />
                ) : (
                  <WifiOff aria-hidden className="size-4 text-status-serious" />
                )}
                <div className="min-w-40 flex-1">
                  <Link to={`/placas/${device.id}`} className="font-mono text-sm underline-offset-2 hover:underline">
                    {device.macAddress}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {device.isOnline ? 'Online' : 'Sem sinal'}
                    {device.lastSeenAt ? ` · último contato ${formatRelative(device.lastSeenAt)}` : ' · nunca enviou dados'}
                  </p>
                </div>
                <ConfirmDialog
                  trigger={
                    <Button variant="outline" size="sm">
                      Desvincular
                    </Button>
                  }
                  title="Desvincular esta placa?"
                  description="Os próximos dados da placa vão para a quarentena até um novo vínculo. As leituras já registradas continuam nesta unidade."
                  confirmLabel="Desvincular"
                  onConfirm={() => unbind.mutate(device.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid grid-cols-1 gap-3">
        <h2 className="font-medium">Histórico de vínculos</h2>
        {associations.isPending ? (
          <LoadingState />
        ) : associations.isError ? (
          <ErrorState error={associations.error} onRetry={() => void associations.refetch()} />
        ) : associations.data.length === 0 ? (
          <EmptyState title="Nenhum vínculo registrado" />
        ) : (
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Placa</TableHead>
                  <TableHead>Início</TableHead>
                  <TableHead>Fim</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {associations.data.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-xs">{item.device.macAddress}</TableCell>
                    <TableCell className="tabular-nums">{formatDateTime(item.startDate)}</TableCell>
                    <TableCell className="tabular-nums">{item.endDate ? formatDateTime(item.endDate) : <Badge>Ativo</Badge>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  )
}

export default function ColdUnitDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const summary = useDashboardSummary()
  const remove = useDeleteColdUnit()

  if (summary.isPending) return <LoadingState />
  if (summary.isError && !summary.data) return <ErrorState error={summary.error} onRetry={() => void summary.refetch()} />

  const unit = summary.data.units.find((item) => item.id === id)

  if (!unit) {
    return (
      <EmptyState
        title="Unidade não encontrada"
        description="Ela pode ter sido excluída ou pertencer a outra empresa."
        action={
          <Button asChild variant="outline">
            <Link to="/unidades">Voltar para unidades</Link>
          </Button>
        }
      />
    )
  }

  const details = [
    COLD_UNIT_TYPE_LABELS[unit.type],
    unit.licensePlate,
    unit.location,
  ].filter(Boolean).join(' · ')

  return (
    <>
      <Link to="/unidades" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft aria-hidden className="size-4" />
        Unidades
      </Link>
      <PageHeader
        title={unit.name}
        description={details}
        actions={
          isAdminRole(user?.role) && (
            <>
              <ColdUnitFormDialog
                key={unit.id}
                unit={unit}
                trigger={
                  <Button variant="outline">
                    <Pencil aria-hidden />
                    Editar
                  </Button>
                }
              />
              <ConfirmDialog
                trigger={
                  <Button variant="outline">
                    <Trash2 aria-hidden />
                    Excluir
                  </Button>
                }
                title={`Excluir "${unit.name}"?`}
                description="Os vínculos são encerrados, e os próximos dados das placas vão para a quarentena. A unidade some das listas e dos alertas."
                confirmLabel="Excluir unidade"
                onConfirm={() => remove.mutate(unit.id, { onSuccess: () => void navigate('/unidades') })}
              />
            </>
          )
        }
      />

      <Tabs defaultValue="overview" className="gap-4">
        <div className="max-w-full overflow-x-auto">
          <TabsList>
            <TabsTrigger value="overview">Visão geral</TabsTrigger>
            <TabsTrigger value="readings">Leituras</TabsTrigger>
            <TabsTrigger value="alerts">Alertas{unit.pendingAlerts > 0 && ` (${unit.pendingAlerts})`}</TabsTrigger>
            <TabsTrigger value="devices">Placas e vínculos</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="grid grid-cols-1 gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Card className="gap-1 py-4">
              <CardContent className="px-4">
                <p className="text-sm text-muted-foreground">Status</p>
                <UnitStatusBadge status={unit.status} className="mt-1 text-base" />
              </CardContent>
            </Card>
            <Card className="gap-1 py-4">
              <CardContent className="px-4">
                <p className="text-sm text-muted-foreground">Última leitura</p>
                <p className="mt-1 text-2xl font-semibold">{unit.lastReading ? formatTemperature(unit.lastReading.temperature) : '—'}</p>
                {unit.lastReading && <p className="text-xs text-muted-foreground">{formatRelative(unit.lastReading.timestamp)}</p>}
              </CardContent>
            </Card>
            <Card className="gap-1 py-4">
              <CardContent className="px-4">
                <p className="text-sm text-muted-foreground">Faixa segura</p>
                <p className="mt-1 text-2xl font-semibold">
                  {formatTemperature(unit.minTemperature)} a {formatTemperature(unit.maxTemperature)}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Temperatura</CardTitle>
            </CardHeader>
            <CardContent>
              <TemperatureChart
                coldUnitId={unit.id}
                minTemperature={unit.minTemperature}
                maxTemperature={unit.maxTemperature}
                offlineThresholdMinutes={summary.data.offlineThresholdMinutes}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="readings">
          <ReadingsTab unit={unit} />
        </TabsContent>

        <TabsContent value="alerts">
          <AlertsPanel coldUnitId={unit.id} />
        </TabsContent>

        <TabsContent value="devices">
          <DevicesTab unit={unit} />
        </TabsContent>
      </Tabs>
    </>
  )
}
