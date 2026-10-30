import { Bell } from 'lucide-react'
import { Link } from 'react-router'
import { COLD_UNIT_TYPE_LABELS } from '@/shared/domain'
import { formatRelative, formatTemperature } from '@/shared/lib/format'
import { UnitStatusBadge } from '@/shared/ui/unit-status-badge'
import type { UnitSummary } from '../types'

export function UnitCard({ unit }: { unit: UnitSummary }) {
  return (
    <Link
      to={`/unidades/${unit.id}`}
      className="flex flex-col gap-3 rounded-lg border bg-card p-4 transition-colors hover:border-primary focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate font-medium">{unit.name}</h2>
          <p className="truncate text-xs text-muted-foreground">
            {COLD_UNIT_TYPE_LABELS[unit.type]}
            {unit.licensePlate && ` · ${unit.licensePlate}`}
          </p>
        </div>
        <UnitStatusBadge status={unit.status} />
      </div>

      <p className="text-3xl font-semibold tracking-tight">
        {unit.lastReading ? formatTemperature(unit.lastReading.temperature) : '—'}
      </p>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>
          Faixa: {formatTemperature(unit.minTemperature)} a {formatTemperature(unit.maxTemperature)}
        </span>
        <span>{unit.lastReading ? formatRelative(unit.lastReading.timestamp) : 'Sem leituras'}</span>
      </div>

      {unit.pendingAlerts > 0 && (
        <p className="flex items-center gap-1.5 border-t pt-2 text-xs font-medium">
          <Bell aria-hidden className="size-3.5 text-status-critical" />
          {unit.pendingAlerts === 1 ? '1 alerta pendente' : `${unit.pendingAlerts} alertas pendentes`}
        </p>
      )}
    </Link>
  )
}
