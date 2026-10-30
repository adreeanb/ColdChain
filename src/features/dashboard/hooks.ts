import { useQuery } from '@tanstack/react-query'
import { SUMMARY_POLL_MS } from '@/shared/polling'
import { getDashboardSummary } from './api'

export const SUMMARY_KEY = ['dashboard-summary'] as const

export function useDashboardSummary() {
  return useQuery({
    queryKey: SUMMARY_KEY,
    queryFn: getDashboardSummary,
    refetchInterval: SUMMARY_POLL_MS,
  })
}
