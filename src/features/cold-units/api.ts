import { api } from '@/shared/api/client'
import type { ColdUnit, ColdUnitAssociation, ColdUnitInput, SeriesBucket, TemperatureReading } from './types'

export async function listColdUnits() {
  const { data } = await api.get<ColdUnit[]>('/cold-units')
  return data
}

export async function createColdUnit(input: ColdUnitInput) {
  const { data } = await api.post<ColdUnit>('/cold-units', input)
  return data
}

export async function updateColdUnit(id: string, input: ColdUnitInput) {
  const { data } = await api.put<ColdUnit>(`/cold-units/${id}`, input)
  return data
}

export async function deleteColdUnit(id: string) {
  await api.delete(`/cold-units/${id}`)
}

export async function listReadings(id: string, params: { limit: number; deviceId?: string | undefined }) {
  const { data } = await api.get<TemperatureReading[]>(`/cold-units/${id}/readings`, { params })
  return data
}

export async function listSeries(id: string, params: { startDate: string; endDate: string; bucketMinutes: number }) {
  const { data } = await api.get<SeriesBucket[]>(`/cold-units/${id}/readings/series`, { params })
  return data
}

export async function listAssociations(id: string) {
  const { data } = await api.get<ColdUnitAssociation[]>(`/cold-units/${id}/associations`)
  return data
}

export async function unbindDevice(deviceId: string) {
  const { data } = await api.post<{ message: string }>(`/devices/${deviceId}/unbind`)
  return data
}
