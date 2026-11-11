import { api } from '@/shared/api/client'
import type { BindInput, BindResult, Device, DeviceAssociation, DeviceKey, UnboundDevice } from './types'

export async function listDevices(params: { enterpriseId?: string | undefined; includeInactive?: boolean }) {
  const { data } = await api.get<Device[]>('/devices', { params })
  return data
}

export async function listUnboundDevices() {
  const { data } = await api.get<UnboundDevice[]>('/devices/unbound')
  return data
}

export async function listDeviceAssociations(id: string) {
  const { data } = await api.get<DeviceAssociation[]>(`/devices/${id}/associations`)
  return data
}

export async function createDevice(input: { macAddress: string; enterpriseId: string }) {
  const { data } = await api.post<Device & DeviceKey>('/devices', input)
  return data
}

export async function rotateDeviceKey(id: string) {
  const { data } = await api.post<DeviceKey>(`/devices/${id}/key`)
  return data
}

export async function bindDevice(input: BindInput) {
  const { data } = await api.post<BindResult>('/devices/bind', input)
  return data
}

export async function unbindDevice(id: string) {
  const { data } = await api.post<{ message: string }>(`/devices/${id}/unbind`)
  return data
}

export async function deactivateDevice(id: string) {
  const { data } = await api.patch<Device>(`/devices/${id}/deactivate`)
  return data
}
