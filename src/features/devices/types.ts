import type { ColdUnitType } from '@/shared/domain'

export interface Device {
  id: string
  macAddress: string
  isActive: boolean
  createdAt: string
  enterpriseId: string
  lastSeenAt: string | null
  isOnline: boolean
  offlineThresholdMinutes: number
  associations: { id: string; coldUnit: { id: string; name: string; type: ColdUnitType } }[]
}

// Só a resposta do cadastro e da troca de chave traz a chave em texto
export interface DeviceKey {
  macAddress: string
  deviceKey: string
}

export interface DeviceAssociation {
  id: string
  startDate: string
  endDate: string | null
  coldUnit: { id: string; name: string; type: ColdUnitType }
}

export interface UnboundDevice {
  deviceId: string
  macAddress: string
  pendingReadings: number
  firstReadingAt: string
  lastReadingAt: string
  nextExpirationAt: string
}

export type QuarantineAction = 'recover' | 'discard'

export interface BindInput {
  macAddress: string
  coldUnitId: string
  quarantine: QuarantineAction
}

export interface BindResult {
  association: { id: string; coldUnitId: string; startDate: string }
  recoveredReadings: number
  discardedReadings: number
}
