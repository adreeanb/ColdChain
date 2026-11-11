import type { UserRole } from '@/shared/domain'

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  createdAt: string
}

export interface CreateUserInput {
  name: string
  email: string
  password: string
  role: UserRole
  enterpriseId?: string | undefined
}

export interface UpdateUserInput {
  name: string
  email: string
  role: UserRole
}
