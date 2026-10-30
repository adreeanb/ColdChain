import { api } from '@/shared/api/client'
import type { CurrentUser, LoginResponse } from './types'

export async function login(email: string, password: string) {
  const { data } = await api.post<LoginResponse>('/login', { email, password })
  return data
}

export async function getCurrentUser() {
  const { data } = await api.get<CurrentUser>('/me')
  return data
}

export async function updateProfile(input: { name: string; email: string }) {
  const { data } = await api.put<CurrentUser>('/me', input)
  return data
}

export async function changePassword(input: { currentPassword: string; newPassword: string }) {
  const { data } = await api.put<{ message: string }>('/me/password', input)
  return data
}
