import type { ColdUnitStatus, ColdUnitType, ReadingSourceType } from '@/shared/domain'

export interface UnitReading {
  coldUnitId: string
  deviceId: string
  temperature: number
  sourceType: ReadingSourceType
  timestamp: string
}

export interface UnitDevice {
  id: string
  macAddress: string
  lastSeenAt: string | null
  isOnline: boolean
  lastReading: UnitReading | null
}

export interface UnitSummary {
  id: string
  name: string
  type: ColdUnitType
  minTemperature: number
  maxTemperature: number
  licensePlate: string | null
  isFixedLocation: boolean
  location: string | null
  status: ColdUnitStatus
  lastReading: UnitReading | null
  devices: UnitDevice[]
  pendingAlerts: number
}

export interface DashboardSummary {
  generatedAt: string
  offlineThresholdMinutes: number
  totals: {
    units: number
    normal: number
    outOfRange: number
    noSignal: number
    noDevice: number
    pendingAlerts: number
    quarantinedDevices: number
  }
  units: UnitSummary[]
}
