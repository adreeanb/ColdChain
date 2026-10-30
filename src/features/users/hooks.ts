import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getErrorMessage } from '@/shared/api/client'
import * as usersApi from './api'
import type { CreateUserInput, UpdateUserInput } from './types'

const USERS_KEY = 'users'

export function useUsers(enterpriseId?: string) {
  return useQuery({
    queryKey: [USERS_KEY, enterpriseId],
    queryFn: () => usersApi.listUsers(enterpriseId),
  })
}

export function useCreateUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateUserInput) => usersApi.createUser(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [USERS_KEY] })
      toast.success('Usuário criado.')
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
}

export function useUpdateUser(enterpriseId?: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateUserInput }) => usersApi.updateUser(id, input, enterpriseId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [USERS_KEY] })
      toast.success('Usuário atualizado.')
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
}

export function useDeleteUser(enterpriseId?: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => usersApi.deleteUser(id, enterpriseId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [USERS_KEY] })
      toast.success('Usuário removido.')
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
}
