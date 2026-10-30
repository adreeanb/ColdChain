import { QrCode, ShieldQuestion } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/shared/ui/button'
import { EmptyState, ErrorState, LoadingState, PageHeader } from '@/shared/ui/page'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { DeviceSignal } from '../components/DeviceSignal'
import { useDevices } from '../hooks'

export default function DevicesPage() {
  const devices = useDevices()

  return (
    <>
      <PageHeader
        title="Placas"
        description="Sensores ESP32 da sua empresa."
        actions={
          <>
            <Button asChild variant="outline">
              <Link to="/placas/quarentena">
                <ShieldQuestion aria-hidden />
                Quarentena
              </Link>
            </Button>
            <Button asChild>
              <Link to="/vincular">
                <QrCode aria-hidden />
                Vincular placa
              </Link>
            </Button>
          </>
        }
      />

      {devices.isPending ? (
        <LoadingState />
      ) : devices.isError && !devices.data ? (
        <ErrorState error={devices.error} onRetry={() => void devices.refetch()} />
      ) : devices.data.length === 0 ? (
        <EmptyState title="Nenhuma placa cadastrada" description="O cadastro de placas é feito pelo administrador global (MASTER)." />
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>MAC</TableHead>
                <TableHead>Sinal</TableHead>
                <TableHead>Unidade atual</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {devices.data.map((device) => {
                const unit = device.associations[0]?.coldUnit
                return (
                  <TableRow key={device.id}>
                    <TableCell>
                      <Link to={`/placas/${device.id}`} className="font-mono text-xs underline-offset-2 hover:underline">
                        {device.macAddress}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <DeviceSignal device={device} />
                    </TableCell>
                    <TableCell>
                      {unit ? (
                        <Link to={`/unidades/${unit.id}`} className="underline-offset-2 hover:underline">
                          {unit.name}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">Sem vínculo</span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  )
}
