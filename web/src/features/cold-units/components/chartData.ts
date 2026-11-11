import type { SeriesBucket } from '../types'

export interface ChartDevice {
  id: string
  macAddress: string
  /** Índice fixo na paleta: a cor acompanha a placa, não a posição na lista. */
  colorIndex: number
}

export interface ChartPoint {
  avg: number
  min: number
  max: number
  readings: number
  historical: number
}

export interface ChartRow {
  time: number
  /** Valores que desenham a linha: podem ser interpolados para ligar pontos próximos. */
  line: Record<string, number | null>
  /** Faixa de mínimo e máximo, usada quando há uma única placa. */
  band: [number, number] | null
  /** Valores medidos de verdade, os únicos mostrados na tela como dado. */
  points: Record<string, ChartPoint>
}

export const MAX_CHART_DEVICES = 8

export function buildChartDevices(buckets: SeriesBucket[]): ChartDevice[] {
  const macs = new Map(buckets.map((bucket) => [bucket.deviceId, bucket.macAddress]))

  return [...macs.entries()]
    .sort(([, a], [, b]) => a.localeCompare(b))
    .map(([id, macAddress], colorIndex) => ({ id, macAddress, colorIndex }))
}

/**
 * Monta as linhas do gráfico. Placas enviam em horários diferentes, então um intervalo sem
 * dado só vira interrupção na linha quando passa de `gapMinutes`; antes disso os pontos
 * vizinhos são ligados, para o intervalo de envio do firmware não picotar o traço.
 */
export function buildChartRows(buckets: SeriesBucket[], devices: ChartDevice[], gapMinutes: number): ChartRow[] {
  const gapMs = gapMinutes * 60 * 1000
  const times = [...new Set(buckets.map((bucket) => Date.parse(bucket.bucket)))].sort((a, b) => a - b)

  const perDevice = new Map<string, Map<number, SeriesBucket>>()
  for (const bucket of buckets) {
    const entries = perDevice.get(bucket.deviceId) ?? new Map<number, SeriesBucket>()
    entries.set(Date.parse(bucket.bucket), bucket)
    perDevice.set(bucket.deviceId, entries)
  }

  const interpolate = (entries: Map<number, SeriesBucket>, time: number, pick: (bucket: SeriesBucket) => number) => {
    const known = [...entries.keys()].sort((a, b) => a - b)
    const nextIndex = known.findIndex((candidate) => candidate > time)
    if (nextIndex <= 0) return null

    const previous = known[nextIndex - 1]!
    const next = known[nextIndex]!
    if (next - previous > gapMs) return null

    const ratio = (time - previous) / (next - previous)
    return pick(entries.get(previous)!) + (pick(entries.get(next)!) - pick(entries.get(previous)!)) * ratio
  }

  // Sem nenhum dado por muito tempo, uma linha vazia entre os dois pontos interrompe o traço
  const timeline = times.flatMap((time, index) => {
    const previous = times[index - 1]
    return previous !== undefined && time - previous > gapMs ? [{ time: (previous + time) / 2, isBreak: true }, { time, isBreak: false }] : [{ time, isBreak: false }]
  })

  return timeline.map(({ time, isBreak }) => {
    if (isBreak) {
      return { time, line: Object.fromEntries(devices.map((device) => [device.id, null])), points: {}, band: null }
    }

    const line: Record<string, number | null> = {}
    const points: Record<string, ChartPoint> = {}

    for (const device of devices) {
      const entries = perDevice.get(device.id)
      const bucket = entries?.get(time)

      if (bucket) {
        line[device.id] = bucket.avgTemperature
        points[device.id] = {
          avg: bucket.avgTemperature,
          min: bucket.minTemperature,
          max: bucket.maxTemperature,
          readings: bucket.readings,
          historical: bucket.historicalReadings,
        }
      } else {
        line[device.id] = entries ? interpolate(entries, time, (item) => item.avgTemperature) : null
      }
    }

    const single = devices.length === 1 ? points[devices[0]!.id] : undefined

    return { time, line, points, band: single ? [single.min, single.max] : null }
  })
}

// A faixa segura sempre aparece inteira, mesmo com leituras dentro dela
export function buildYDomain(buckets: SeriesBucket[], minLimit: number, maxLimit: number): [number, number] {
  const values = buckets.flatMap((bucket) => [bucket.minTemperature, bucket.maxTemperature])
  const low = Math.min(minLimit, ...values)
  const high = Math.max(maxLimit, ...values)
  const padding = Math.max(1, (high - low) * 0.1)

  return [Math.floor(low - padding), Math.ceil(high + padding)]
}
