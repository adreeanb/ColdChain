import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getErrorMessage } from '@/shared/api/client'
import * as enterprisesApi from './api'
import type { EnterpriseInput } from './types'

const ENTERPRISES_KEY = 'enterprises'

export function useEnterprises() {
  return useQuery({ queryKey: [ENTERPRISES_KEY], queryFn: enterprisesApi.listEnterprises })
}

export function useEnterprise(id: string) {
  return useQuery({ queryKey: [ENTERPRISES_KEY, id], queryFn: () => enterprisesApi.getEnterprise(id) })
}

export function useSaveEnterprise(id?: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: EnterpriseInput) => (id ? enterprisesApi.updateEnterprise(id, input) : enterprisesApi.createEnterprise(input)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [ENTERPRISES_KEY] })
      toast.success(id ? 'Empresa atualizada.' : 'Empresa criada.')
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
}

export function useDeleteEnterprise() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: enterprisesApi.deleteEnterprise,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [ENTERPRISES_KEY] })
      toast.success('Empresa excluída.')
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
}
