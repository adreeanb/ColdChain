import type { UserRole } from '@/shared/domain'

export interface CurrentUser {
  id: string
  name: string
  email: string
  role: UserRole
  enterpriseId: string
  createdAt: string
}

export interface LoginResponse {
  id: string
  name: string
  email: string
  role: UserRole
  token: string
}
