import { Ban, Wifi, WifiOff } from 'lucide-react'
import { formatRelative } from '@/shared/lib/format'
import type { Device } from '../types'

export function DeviceSignal({ device }: { device: Device }) {
  if (!device.isActive) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm">
        <Ban aria-hidden className="size-4 text-muted-foreground" />
        Desativada
      </span>
    )
  }

  return (
    <span className="inline-flex flex-col">
      <span className="inline-flex items-center gap-1.5 text-sm">
        {device.isOnline ? <Wifi aria-hidden className="size-4 text-status-good" /> : <WifiOff aria-hidden className="size-4 text-status-serious" />}
        {device.isOnline ? 'Online' : 'Sem sinal'}
      </span>
      <span className="text-xs text-muted-foreground">
        {device.lastSeenAt ? `Último contato ${formatRelative(device.lastSeenAt)}` : 'Nunca enviou dados'}
      </span>
    </span>
  )
}
