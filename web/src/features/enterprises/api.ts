import { api } from '@/shared/api/client'
import type { Enterprise, EnterpriseInput } from './types'

export async function listEnterprises() {
  const { data } = await api.get<Enterprise[]>('/enterprises')
  return data
}

export async function getEnterprise(id: string) {
  const { data } = await api.get<Enterprise>(`/enterprises/${id}`)
  return data
}

export async function createEnterprise(input: EnterpriseInput) {
  const { data } = await api.post<Enterprise>('/enterprises', input)
  return data
}

export async function updateEnterprise(id: string, input: EnterpriseInput) {
  const { data } = await api.put<Enterprise>(`/enterprises/${id}`, input)
  return data
}

export async function deleteEnterprise(id: string) {
  await api.delete(`/enterprises/${id}`)
}
