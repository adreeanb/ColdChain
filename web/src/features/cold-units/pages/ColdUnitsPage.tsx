import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Link } from 'react-router'
import { useAuth } from '@/features/auth'
import { useDashboardSummary } from '@/features/dashboard'
import { COLD_UNIT_TYPE_LABELS, isAdminRole, type ColdUnitType } from '@/shared/domain'
import { formatRelative, formatTemperature } from '@/shared/lib/format'
import { Button } from '@/shared/ui/button'
import { NativeSelect } from '@/shared/ui/form'
import { Label } from '@/shared/ui/label'
import { EmptyState, ErrorState, LoadingState, PageHeader } from '@/shared/ui/page'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { UnitStatusBadge } from '@/shared/ui/unit-status-badge'
import { ColdUnitFormDialog } from '../components/ColdUnitFormDialog'

export default function ColdUnitsPage() {
  const { user } = useAuth()
  const summary = useDashboardSummary()
  const [type, setType] = useState<ColdUnitType | ''>('')

  const canManage = isAdminRole(user?.role)
  const createButton = canManage && (
    <ColdUnitFormDialog
      trigger={
        <Button>
          <Plus aria-hidden />
          Nova unidade
        </Button>
      }
    />
  )

  const units = summary.data?.units.filter((unit) => !type || unit.type === type)

  return (
    <>
      <PageHeader title="Unidades" description="Câmaras, armazéns e caminhões monitorados." actions={createButton} />

      {summary.isPending ? (
        <LoadingState />
      ) : summary.isError && !summary.data ? (
        <ErrorState error={summary.error} onRetry={() => void summary.refetch()} />
      ) : summary.data.units.length === 0 ? (
        <EmptyState title="Nenhuma unidade cadastrada" description={canManage ? 'Crie a primeira unidade para começar.' : 'Um administrador precisa cadastrar as unidades.'} />
      ) : (
        <div className="grid grid-cols-1 gap-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="type-filter">Tipo</Label>
            <div className="w-56">
              <NativeSelect id="type-filter" value={type} onChange={(event) => setType(event.target.value as ColdUnitType | '')}>
                <option value="">Todos</option>
                {(Object.keys(COLD_UNIT_TYPE_LABELS) as ColdUnitType[]).map((option) => (
                  <option key={option} value={option}>
                    {COLD_UNIT_TYPE_LABELS[option]}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>

          {units!.length === 0 ? (
            <EmptyState title="Nenhuma unidade deste tipo" />
          ) : (
            <div className="rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Temperatura</TableHead>
                    <TableHead>Faixa segura</TableHead>
                    <TableHead>Última leitura</TableHead>
                    <TableHead className="text-right">Alertas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {units!.map((unit) => (
                    <TableRow key={unit.id}>
                      <TableCell>
                        <Link to={`/unidades/${unit.id}`} className="font-medium underline-offset-2 hover:underline">
                          {unit.name}
                        </Link>
                        <p className="text-xs text-muted-foreground">{COLD_UNIT_TYPE_LABELS[unit.type]}</p>
                      </TableCell>
                      <TableCell>
                        <UnitStatusBadge status={unit.status} />
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {unit.lastReading ? formatTemperature(unit.lastReading.temperature) : '—'}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {formatTemperature(unit.minTemperature)} a {formatTemperature(unit.maxTemperature)}
                      </TableCell>
                      <TableCell>{unit.lastReading ? formatRelative(unit.lastReading.timestamp) : 'Sem leituras'}</TableCell>
                      <TableCell className="text-right tabular-nums">{unit.pendingAlerts}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}
    </>
  )
}
