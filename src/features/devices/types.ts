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
  lastReadingAt: string
  nextExpirationAt: string
}

export interface BindResult {
  association: { id: string; coldUnitId: string; startDate: string }
  recoveredReadings: number
}
