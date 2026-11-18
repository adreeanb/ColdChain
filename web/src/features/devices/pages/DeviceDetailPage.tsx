import { ArrowLeft, KeyRound, QrCode } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { useAuth } from '@/features/auth'
import { COLD_UNIT_TYPE_LABELS } from '@/shared/domain'
import { formatDateTime } from '@/shared/lib/format'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { ConfirmDialog } from '@/shared/ui/confirm-dialog'
import { EmptyState, ErrorState, LoadingState, PageHeader } from '@/shared/ui/page'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { DeviceKeyNotice } from '../components/DeviceKeyNotice'
import { DeviceSignal } from '../components/DeviceSignal'
import { useActivateDevice, useDeviceAssociations, useDevices, useRotateDeviceKey, useUnbindDevice } from '../hooks'

export default function DeviceDetailPage() {
  const { id = '' } = useParams()
  const devices = useDevices({ includeInactive: true })
  const associations = useDeviceAssociations(id)
  const unbind = useUnbindDevice()
  const rotateKey = useRotateDeviceKey()
  const activate = useActivateDevice()
  const { user } = useAuth()

  if (devices.isPending) return <LoadingState />
  if (devices.isError && !devices.data) return <ErrorState error={devices.error} onRetry={() => void devices.refetch()} />

  const device = devices.data.find((item) => item.id === id)

  if (!device) {
    return (
      <EmptyState
        title="Placa não encontrada"
        description="Ela pode pertencer a outra empresa."
        action={
          <Button asChild variant="outline">
            <Link to="/placas">Voltar para placas</Link>
          </Button>
        }
      />
    )
  }

  const unit = device.associations[0]?.coldUnit
  // Chave recém-gerada, pela troca de chave ou pela reativação
  const newKey = rotateKey.data ?? activate.data

  return (
    <>
      <Link to="/placas" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft aria-hidden className="size-4" />
        Placas
      </Link>
      <PageHeader
        title={device.macAddress}
        description={<DeviceSignal device={device} />}
        actions={
          device.isActive ? (
            <>
              <Button asChild variant={unit ? 'outline' : 'default'}>
                <Link to={`/vincular?mac=${encodeURIComponent(device.macAddress)}`}>
                  <QrCode aria-hidden />
                  {unit ? 'Trocar de unidade' : 'Vincular'}
                </Link>
              </Button>
              {unit && (
                <ConfirmDialog
                  trigger={<Button variant="outline">Desvincular</Button>}
                  title="Desvincular esta placa?"
                  description={`A placa sai de "${unit.name}", e os próximos dados vão para a quarentena até um novo vínculo.`}
                  confirmLabel="Desvincular"
                  onConfirm={() => unbind.mutate(device.id)}
                />
              )}
              {user?.role === 'MASTER' && (
                <ConfirmDialog
                  trigger={
                    <Button variant="outline">
                      <KeyRound aria-hidden />
                      Gerar nova chave
                    </Button>
                  }
                  title="Gerar uma nova chave para esta placa?"
                  description="A chave atual deixa de valer na hora: a placa só volta a enviar dados depois que a nova for informada no portal de configuração dela."
                  confirmLabel="Gerar chave"
                  onConfirm={() => rotateKey.mutate(device.id)}
                />
              )}
            </>
          ) : (
            user?.role === 'MASTER' && (
              <ConfirmDialog
                trigger={
                  <Button>
                    <KeyRound aria-hidden />
                    Reativar
                  </Button>
                }
                title="Reativar esta placa?"
                description="A placa volta sem vínculo e com uma chave nova, que aparece uma única vez. Cole a chave no portal de configuração da placa e vincule-a pelo QR Code."
                confirmLabel="Reativar placa"
                onConfirm={() => activate.mutate(device.id)}
              />
            )
          )
        }
      />

      {newKey && (
        <div className="mb-6 max-w-2xl">
          <DeviceKeyNotice {...newKey} />
        </div>
      )}

      <h2 className="mb-3 font-medium">Histórico de vínculos</h2>
      {associations.isPending ? (
        <LoadingState />
      ) : associations.isError ? (
        <ErrorState error={associations.error} onRetry={() => void associations.refetch()} />
      ) : associations.data.length === 0 ? (
        <EmptyState title="Esta placa ainda não foi vinculada" />
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Unidade</TableHead>
                <TableHead>Início</TableHead>
                <TableHead>Fim</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {associations.data.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    {item.coldUnit.name}
                    <p className="text-xs text-muted-foreground">{COLD_UNIT_TYPE_LABELS[item.coldUnit.type]}</p>
                  </TableCell>
                  <TableCell className="tabular-nums">{formatDateTime(item.startDate)}</TableCell>
                  <TableCell className="tabular-nums">{item.endDate ? formatDateTime(item.endDate) : <Badge>Ativo</Badge>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  )
}
