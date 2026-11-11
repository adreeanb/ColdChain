import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { SUMMARY_KEY } from '@/features/dashboard'
import { getErrorMessage } from '@/shared/api/client'
import { ALERTS_COUNT_POLL_MS, pollInterval } from '@/shared/polling'
import { listAlerts, resolveAlert } from './api'
import type { AlertsParams } from './types'

const ALERTS_KEY = 'alerts'

export function useAlerts(params: AlertsParams) {
  return useQuery({
    queryKey: [ALERTS_KEY, params],
    queryFn: () => listAlerts(params),
    placeholderData: keepPreviousData,
    refetchInterval: pollInterval(ALERTS_COUNT_POLL_MS),
  })
}

export function usePendingAlertsCount() {
  const { data } = useQuery({
    queryKey: [ALERTS_KEY, 'pending-count'],
    queryFn: () => listAlerts({ status: 'pending', pageSize: 1 }),
    refetchInterval: pollInterval(ALERTS_COUNT_POLL_MS),
  })

  return data?.total ?? 0
}

export function useResolveAlert() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: resolveAlert,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [ALERTS_KEY] })
      void queryClient.invalidateQueries({ queryKey: SUMMARY_KEY })
      toast.success('Alerta resolvido.')
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
}
