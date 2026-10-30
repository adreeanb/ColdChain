import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { SUMMARY_KEY } from '@/features/dashboard'
import { getErrorMessage } from '@/shared/api/client'
import { SUMMARY_POLL_MS } from '@/shared/polling'
import * as devicesApi from './api'

function useInvalidateDevices() {
  const queryClient = useQueryClient()

  return () => {
    void queryClient.invalidateQueries({ queryKey: ['devices'] })
    void queryClient.invalidateQueries({ queryKey: ['cold-units'] })
    void queryClient.invalidateQueries({ queryKey: ['alerts'] })
    void queryClient.invalidateQueries({ queryKey: SUMMARY_KEY })
  }
}

export function useDevices(params: { enterpriseId?: string | undefined; includeInactive?: boolean } = {}) {
  return useQuery({
    queryKey: ['devices', 'list', params],
    queryFn: () => devicesApi.listDevices(params),
    refetchInterval: SUMMARY_POLL_MS,
  })
}

export function useUnboundDevices() {
  return useQuery({
    queryKey: ['devices', 'unbound'],
    queryFn: devicesApi.listUnboundDevices,
    refetchInterval: SUMMARY_POLL_MS,
  })
}

export function useDeviceAssociations(id: string) {
  return useQuery({
    queryKey: ['devices', id, 'associations'],
    queryFn: () => devicesApi.listDeviceAssociations(id),
  })
}

export function useBindDevice() {
  const invalidate = useInvalidateDevices()

  return useMutation({ mutationFn: devicesApi.bindDevice, onSuccess: invalidate })
}

export function useUnbindDevice() {
  const invalidate = useInvalidateDevices()

  return useMutation({
    mutationFn: devicesApi.unbindDevice,
    onSuccess: () => {
      invalidate()
      toast.success('Placa desvinculada.')
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
}

export function useCreateDevice() {
  const invalidate = useInvalidateDevices()

  return useMutation({
    mutationFn: devicesApi.createDevice,
    onSuccess: () => {
      invalidate()
      toast.success('Placa cadastrada.')
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
}

export function useDeactivateDevice() {
  const invalidate = useInvalidateDevices()

  return useMutation({
    mutationFn: devicesApi.deactivateDevice,
    onSuccess: () => {
      invalidate()
      toast.success('Placa desativada.')
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
}
