import { Link } from 'react-router'
import { formatCountdown, formatDateTime } from '@/shared/lib/format'
import { Button } from '@/shared/ui/button'
import { EmptyState, ErrorState, LoadingState, PageHeader } from '@/shared/ui/page'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { useUnboundDevices } from '../hooks'

export default function QuarantinePage() {
  const unbound = useUnboundDevices()

  return (
    <>
      <PageHeader
        title="Quarentena"
        description="Placas que enviaram dados sem vínculo. Vincule antes de expirar, ou as leituras serão apagadas."
      />

      {unbound.isPending ? (
        <LoadingState />
      ) : unbound.isError && !unbound.data ? (
        <ErrorState error={unbound.error} onRetry={() => void unbound.refetch()} />
      ) : unbound.data.length === 0 ? (
        <EmptyState title="Nenhum dado em quarentena" description="Todas as placas que enviaram dados estão vinculadas." />
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>MAC</TableHead>
                <TableHead className="text-right">Leituras retidas</TableHead>
                <TableHead>Última leitura</TableHead>
                <TableHead>Primeira expiração em</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {unbound.data.map((item) => (
                <TableRow key={item.deviceId}>
                  <TableCell className="font-mono text-xs">{item.macAddress}</TableCell>
                  <TableCell className="text-right tabular-nums">{item.pendingReadings}</TableCell>
                  <TableCell className="tabular-nums">{formatDateTime(item.lastReadingAt)}</TableCell>
                  <TableCell className="tabular-nums">{formatCountdown(item.nextExpirationAt)}</TableCell>
                  <TableCell className="text-right">
                    <Button asChild size="sm">
                      <Link to={`/vincular?mac=${encodeURIComponent(item.macAddress)}`}>Vincular</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  )
}
