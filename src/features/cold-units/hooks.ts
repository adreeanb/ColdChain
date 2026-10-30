import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { SUMMARY_KEY } from '@/features/dashboard'
import { getErrorMessage } from '@/shared/api/client'
import { CHART_POLL_MS } from '@/shared/polling'
import * as coldUnitsApi from './api'
import type { ColdUnitInput } from './types'

const COLD_UNITS_KEY = ['cold-units'] as const

function useInvalidateUnits() {
  const queryClient = useQueryClient()

  return () => {
    void queryClient.invalidateQueries({ queryKey: COLD_UNITS_KEY })
    void queryClient.invalidateQueries({ queryKey: SUMMARY_KEY })
  }
}

export function useColdUnits() {
  return useQuery({ queryKey: COLD_UNITS_KEY, queryFn: coldUnitsApi.listColdUnits })
}

export function useSaveColdUnit(id?: string) {
  const invalidate = useInvalidateUnits()

  return useMutation({
    mutationFn: (input: ColdUnitInput) => (id ? coldUnitsApi.updateColdUnit(id, input) : coldUnitsApi.createColdUnit(input)),
    onSuccess: () => {
      invalidate()
      toast.success(id ? 'Unidade atualizada.' : 'Unidade criada.')
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
}

export function useDeleteColdUnit() {
  const invalidate = useInvalidateUnits()

  return useMutation({
    mutationFn: coldUnitsApi.deleteColdUnit,
    onSuccess: () => {
      invalidate()
      toast.success('Unidade excluída.')
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
}

export function useTemperatureSeries(id: string, rangeMinutes: number, bucketMinutes: number) {
  return useQuery({
    queryKey: ['cold-units', id, 'series', rangeMinutes, bucketMinutes],
    queryFn: async () => {
      // O período anda junto com o relógio a cada atualização
      const end = new Date()
      const start = new Date(end.getTime() - rangeMinutes * 60 * 1000)
      const buckets = await coldUnitsApi.listSeries(id, {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        bucketMinutes,
      })
      return { buckets, start: start.getTime(), end: end.getTime() }
    },
    placeholderData: keepPreviousData,
    refetchInterval: CHART_POLL_MS,
  })
}

export function useReadings(id: string, deviceId: string | undefined) {
  return useQuery({
    queryKey: ['cold-units', id, 'readings', deviceId],
    queryFn: () => coldUnitsApi.listReadings(id, { limit: 100, deviceId }),
    placeholderData: keepPreviousData,
    refetchInterval: CHART_POLL_MS,
  })
}

export function useUnitAssociations(id: string) {
  return useQuery({
    queryKey: ['cold-units', id, 'associations'],
    queryFn: () => coldUnitsApi.listAssociations(id),
  })
}

export function useUnbindFromUnit(id: string) {
  const queryClient = useQueryClient()
  const invalidate = useInvalidateUnits()

  return useMutation({
    mutationFn: coldUnitsApi.unbindDevice,
    onSuccess: () => {
      invalidate()
      void queryClient.invalidateQueries({ queryKey: ['cold-units', id, 'associations'] })
      void queryClient.invalidateQueries({ queryKey: ['devices'] })
      toast.success('Placa desvinculada.')
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
}
