export type UserRole = 'MASTER' | 'ADMIN' | 'OPERATOR'
export type ColdUnitType = 'COLD_ROOM' | 'COLD_STORAGE' | 'REEFER_TRUCK'
export type ColdUnitStatus = 'NORMAL' | 'OUT_OF_RANGE' | 'NO_SIGNAL' | 'NO_DEVICE'
export type ReadingSourceType = 'REALTIME' | 'HISTORICAL'

export const COLD_UNIT_TYPE_LABELS: Record<ColdUnitType, string> = {
  COLD_ROOM: 'Câmara fria',
  COLD_STORAGE: 'Armazém frigorífico',
  REEFER_TRUCK: 'Caminhão refrigerado',
}

export const ROLE_LABELS: Record<UserRole, string> = {
  MASTER: 'Master',
  ADMIN: 'Administrador',
  OPERATOR: 'Operador',
}

export function isAdminRole(role: UserRole | undefined) {
  return role === 'ADMIN' || role === 'MASTER'
}
