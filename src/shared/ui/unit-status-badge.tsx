import { CircleCheck, Unplug, TriangleAlert, WifiOff, type LucideIcon } from 'lucide-react'
import type { ColdUnitStatus } from '@/shared/domain'
import { cn } from '@/shared/lib/utils'

const STATUS: Record<ColdUnitStatus, { label: string; icon: LucideIcon; iconClass: string }> = {
  NORMAL: { label: 'Normal', icon: CircleCheck, iconClass: 'text-status-good' },
  OUT_OF_RANGE: { label: 'Fora dos limites', icon: TriangleAlert, iconClass: 'text-status-critical' },
  NO_SIGNAL: { label: 'Sem sinal', icon: WifiOff, iconClass: 'text-status-serious' },
  NO_DEVICE: { label: 'Sem placa', icon: Unplug, iconClass: 'text-muted-foreground' },
}

export function UnitStatusBadge({ status, className }: { status: ColdUnitStatus; className?: string }) {
  const { label, icon: Icon, iconClass } = STATUS[status]

  return (
    <span className={cn('inline-flex items-center gap-1.5 text-sm font-medium whitespace-nowrap', className)}>
      <Icon aria-hidden className={cn('size-4 shrink-0', iconClass)} />
      {label}
    </span>
  )
}
