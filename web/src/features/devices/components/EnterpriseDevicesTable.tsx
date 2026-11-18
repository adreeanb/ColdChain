import { Button } from '@/shared/ui/button'
import { ConfirmDialog } from '@/shared/ui/confirm-dialog'
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/page'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { useActivateDevice, useDeactivateDevice, useDevices } from '../hooks'
import { DeviceKeyNotice } from './DeviceKeyNotice'
import { DeviceSignal } from './DeviceSignal'

// Placas de uma empresa, inclusive as desativadas. Usado pelo MASTER.
export function EnterpriseDevicesTable({ enterpriseId }: { enterpriseId: string }) {
  const devices = useDevices({ enterpriseId, includeInactive: true })
  const deactivate = useDeactivateDevice()
  const activate = useActivateDevice()

  if (devices.isPending) return <LoadingState />
  if (devices.isError && !devices.data) return <ErrorState error={devices.error} onRetry={() => void devices.refetch()} />
  if (devices.data.length === 0) return <EmptyState title="Nenhuma placa cadastrada nesta empresa" />

  return (
    <div className="grid grid-cols-1 gap-4">
      {activate.data && (
        <div className="max-w-2xl">
          <DeviceKeyNotice {...activate.data} />
        </div>
      )}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>MAC</TableHead>
              <TableHead>Sinal</TableHead>
              <TableHead>Unidade atual</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {devices.data.map((device) => (
              <TableRow key={device.id}>
                <TableCell className="font-mono text-xs">{device.macAddress}</TableCell>
                <TableCell>
                  <DeviceSignal device={device} />
                </TableCell>
                <TableCell>{device.associations[0]?.coldUnit.name ?? 'Sem vínculo'}</TableCell>
                <TableCell className="text-right">
                  {device.isActive && (
                    <ConfirmDialog
                      trigger={
                        <Button variant="outline" size="sm">
                          Desativar
                        </Button>
                      }
                      title={`Desativar a placa ${device.macAddress}?`}
                      description="O vínculo é encerrado, e os dados desta placa passam a ser descartados. O histórico é mantido. Dá para reativá-la depois, com uma chave nova."
                      confirmLabel="Desativar placa"
                      onConfirm={() => deactivate.mutate(device.id)}
                    />
                  )}
                  {!device.isActive && (
                    <ConfirmDialog
                      trigger={
                        <Button variant="outline" size="sm">
                          Reativar
                        </Button>
                      }
                      title={`Reativar a placa ${device.macAddress}?`}
                      description="A placa volta sem vínculo e com uma chave nova, que aparece uma única vez. Cole a chave no portal de configuração da placa e vincule-a pelo QR Code."
                      confirmLabel="Reativar placa"
                      onConfirm={() => activate.mutate(device.id)}
                    />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
