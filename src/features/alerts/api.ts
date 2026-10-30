import { api } from '@/shared/api/client'
import type { AlertsPage, AlertsParams } from './types'

export async function listAlerts(params: AlertsParams) {
  const { data } = await api.get<AlertsPage>('/alerts', { params })
  return data
}

export async function resolveAlert(id: string) {
  const { data } = await api.patch(`/alerts/${id}/resolve`)
  return data
}
