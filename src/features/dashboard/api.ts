import { api } from '@/shared/api/client'
import type { DashboardSummary } from './types'

export async function getDashboardSummary() {
  const { data } = await api.get<DashboardSummary>('/dashboard/summary')
  return data
}
