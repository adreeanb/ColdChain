import type { ColdUnitType } from '@/shared/domain'

export type AlertStatusFilter = 'pending' | 'resolved'

export type AlertType = 'OUT_OF_RANGE' | 'SENSOR_OFFLINE'

// Episódio: leituras seguidas fora da faixa formam um único alerta, assim como um período sem sinal
export interface TemperatureAlert {
  id: string
  type: AlertType
  message: string
  // Nulas em SENSOR_OFFLINE
  temperature: number | null
  peakTemperature: number | null
  readingsCount: number
  startedAt: string
  lastReadingAt: string
  endedAt: string | null
  resolvedAt: string | null
  createdAt: string
  coldUnitId: string
  coldUnit: { name: string; type: ColdUnitType }
  device: { macAddress: string } | null
}

export interface AlertsPage {
  data: TemperatureAlert[]
  total: number
  page: number
  pageSize: number
}

export interface AlertsParams {
  status: AlertStatusFilter
  coldUnitId?: string | undefined
  page?: number
  pageSize?: number
}
