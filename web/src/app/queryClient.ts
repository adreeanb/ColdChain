import { QueryClient } from '@tanstack/react-query'
import { getErrorStatus } from '@/shared/api/client'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10 * 1000,
      // Erros 4xx são definitivos; só falhas de rede ou do servidor merecem nova tentativa
      retry: (failureCount, error) => {
        const status = getErrorStatus(error)
        if (status !== undefined && status < 500) return false
        return failureCount < 2
      },
    },
  },
})
