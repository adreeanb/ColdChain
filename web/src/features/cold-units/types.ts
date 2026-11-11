import type { ColdUnitType, ReadingSourceType } from '@/shared/domain'

export interface ColdUnit {
  id: string
  name: string
  type: ColdUnitType
  minTemperature: number
  maxTemperature: number
  licensePlate: string | null
  isFixedLocation: boolean
  location: string | null
}

export interface ColdUnitInput {
  name: string
  type: ColdUnitType
  minTemperature: number
  maxTemperature: number
  licensePlate: string | null
  isFixedLocation: boolean
  location: string | null
}

export interface TemperatureReading {
  id: string
  temperature: number
  sourceType: ReadingSourceType
  timestamp: string
  createdAt: string
  deviceId: string
  device: { macAddress: string }
}

export interface SeriesBucket {
  bucket: string
  deviceId: string
  macAddress: string
  minTemperature: number
  avgTemperature: number
  maxTemperature: number
  readings: number
  historicalReadings: number
}

export interface ColdUnitAssociation {
  id: string
  startDate: string
  endDate: string | null
  device: { id: string; macAddress: string }
}
