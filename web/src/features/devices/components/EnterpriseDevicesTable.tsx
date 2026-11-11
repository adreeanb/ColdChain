import { Button } from '@/shared/ui/button'
import { ConfirmDialog } from '@/shared/ui/confirm-dialog'
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/page'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { useDeactivateDevice, useDevices } from '../hooks'
import { DeviceSignal } from './DeviceSignal'

// Placas de uma empresa, inclusive as desativadas. Usado pelo MASTER.
export function EnterpriseDevicesTable({ enterpriseId }: { enterpriseId: string }) {
  const devices = useDevices({ enterpriseId, includeInactive: true })
  const deactivate = useDeactivateDevice()

  if (devices.isPending) return <LoadingState />
  if (devices.isError && !devices.data) return <ErrorState error={devices.error} onRetry={() => void devices.refetch()} />
  if (devices.data.length === 0) return <EmptyState title="Nenhuma placa cadastrada nesta empresa" />

  return (
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
                    description="O vínculo é encerrado, e os dados desta placa passam a ser descartados. O histórico é mantido. Esta ação não pode ser desfeita pelo sistema."
                    confirmLabel="Desativar placa"
                    onConfirm={() => deactivate.mutate(device.id)}
                  />
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
