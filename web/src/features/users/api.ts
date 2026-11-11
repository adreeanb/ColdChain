import { api } from '@/shared/api/client'
import type { CreateUserInput, UpdateUserInput, User } from './types'

// enterpriseId só é considerado pela API quando quem chama é MASTER
export async function listUsers(enterpriseId?: string) {
  const { data } = await api.get<User[]>('/users', { params: { enterpriseId } })
  return data
}

export async function createUser(input: CreateUserInput) {
  const { data } = await api.post<User>('/users', input)
  return data
}

export async function updateUser(id: string, input: UpdateUserInput, enterpriseId?: string) {
  const { data } = await api.put<User>(`/users/${id}`, input, { params: { enterpriseId } })
  return data
}

export async function deleteUser(id: string, enterpriseId?: string) {
  await api.delete(`/users/${id}`, { params: { enterpriseId } })
}
