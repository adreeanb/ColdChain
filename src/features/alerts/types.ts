import type { ColdUnitType } from '@/shared/domain'

export type AlertStatusFilter = 'pending' | 'resolved'

export interface TemperatureAlert {
  id: string
  message: string
  temperature: number
  resolvedAt: string | null
  createdAt: string
  coldUnitId: string
  coldUnit: { name: string; type: ColdUnitType }
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
