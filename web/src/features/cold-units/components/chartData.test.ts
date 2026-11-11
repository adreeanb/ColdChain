import type { SeriesBucket } from '../types'
import { buildChartDevices, buildChartRows, buildYDomain } from './chartData'

const bucket = (minute: number, deviceId: string, temperature: number, extra: Partial<SeriesBucket> = {}): SeriesBucket => ({
  bucket: new Date(Date.UTC(2026, 0, 1, 0, minute)).toISOString(),
  deviceId,
  macAddress: deviceId === 'b' ? 'BB:00:00:00:00:00' : 'AA:00:00:00:00:00',
  minTemperature: temperature,
  avgTemperature: temperature,
  maxTemperature: temperature,
  readings: 1,
  historicalReadings: 0,
  ...extra,
})

describe('buildChartDevices', () => {
  it('fixa a cor pela ordem do MAC, não pela ordem de chegada', () => {
    const devices = buildChartDevices([bucket(0, 'b', 1), bucket(0, 'a', 1)])
    expect(devices.map((device) => [device.id, device.colorIndex])).toEqual([['a', 0], ['b', 1]])
  })
})

describe('buildChartRows', () => {
  it('interrompe a linha quando a placa fica muito tempo sem enviar', () => {
    const buckets = [bucket(0, 'a', 1), bucket(60, 'a', 2)]
    const rows = buildChartRows(buckets, buildChartDevices(buckets), 10)

    expect(rows).toHaveLength(3)
    expect(rows[1]!.line.a).toBeNull()
    expect(rows[1]!.points).toEqual({})
  })

  it('não interrompe em intervalos curtos', () => {
    const buckets = [bucket(0, 'a', 1), bucket(5, 'a', 2)]
    const rows = buildChartRows(buckets, buildChartDevices(buckets), 10)

    expect(rows).toHaveLength(2)
    expect(rows.every((row) => row.line.a !== null)).toBe(true)
  })

  it('liga os pontos de uma placa quando a outra envia entre eles, sem inventar medição', () => {
    const buckets = [bucket(0, 'a', 2), bucket(5, 'b', 9), bucket(10, 'a', 4)]
    const rows = buildChartRows(buckets, buildChartDevices(buckets), 15)

    expect(rows[1]!.line.a).toBe(3)
    expect(rows[1]!.points.a).toBeUndefined()
    expect(rows[1]!.points.b?.avg).toBe(9)
  })

  it('não liga os pontos de uma placa parada enquanto a outra continua enviando', () => {
    const buckets = [bucket(0, 'a', 2), bucket(0, 'b', 5), bucket(30, 'b', 5), bucket(60, 'a', 4), bucket(60, 'b', 5)]
    const rows = buildChartRows(buckets, buildChartDevices(buckets), 45)

    expect(rows.find((row) => row.time === Date.UTC(2026, 0, 1, 0, 30))!.line.a).toBeNull()
    expect(rows.find((row) => row.time === Date.UTC(2026, 0, 1, 0, 30))!.line.b).toBe(5)
  })

  it('só desenha a faixa de mínimo e máximo com uma única placa', () => {
    const single = [bucket(0, 'a', 2, { minTemperature: 1, maxTemperature: 3 })]
    expect(buildChartRows(single, buildChartDevices(single), 10)[0]!.band).toEqual([1, 3])

    const two = [...single, bucket(0, 'b', 5)]
    expect(buildChartRows(two, buildChartDevices(two), 10)[0]!.band).toBeNull()
  })
})

describe('buildYDomain', () => {
  it('sempre inclui a faixa segura e os picos', () => {
    const [low, high] = buildYDomain([bucket(0, 'a', 3, { maxTemperature: 20 })], 0, 5)
    expect(low).toBeLessThan(0)
    expect(high).toBeGreaterThan(20)
  })

  it('funciona sem leituras', () => {
    const [low, high] = buildYDomain([], 2, 8)
    expect(low).toBeLessThan(2)
    expect(high).toBeGreaterThan(8)
  })
})
