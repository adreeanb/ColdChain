import { useMemo, useState } from 'react'
import { Area, CartesianGrid, ComposedChart, Line, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatDay, formatFullDateTime, formatTemperature, formatTime } from '@/shared/lib/format'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/page'
import { useTemperatureSeries } from '../hooks'
import { buildChartDevices, buildChartRows, buildYDomain, MAX_CHART_DEVICES, type ChartDevice, type ChartRow } from './chartData'

const RANGES = [
  { label: '1 h', minutes: 60, bucket: 1 },
  { label: '6 h', minutes: 6 * 60, bucket: 5 },
  { label: '24 h', minutes: 24 * 60, bucket: 15 },
  { label: '7 dias', minutes: 7 * 24 * 60, bucket: 60 },
  { label: '30 dias', minutes: 30 * 24 * 60, bucket: 240 },
] as const

const TICK_COUNT = 6

const seriesColor = (device: ChartDevice) => `var(--series-${device.colorIndex + 1})`

function ChartTooltip({ active, row, devices }: { active: boolean; row: ChartRow | undefined; devices: ChartDevice[] }) {
  if (!active || !row) return null

  const measured = devices.filter((device) => row.points[device.id])
  if (measured.length === 0) return null

  return (
    <div className="grid grid-cols-1 gap-1.5 rounded-md border bg-popover p-2.5 text-xs shadow-md">
      <p className="font-medium">{formatFullDateTime(row.time)}</p>
      {measured.map((device) => {
        const point = row.points[device.id]!
        return (
          <div key={device.id} className="grid grid-cols-1 gap-0.5">
            <p className="flex items-center gap-1.5">
              <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: seriesColor(device) }} />
              <span className="font-mono text-muted-foreground">{device.macAddress}</span>
            </p>
            <p className="font-medium tabular-nums">
              Média {formatTemperature(point.avg)}
              <span className="font-normal text-muted-foreground">
                {' '}
                · mín. {formatTemperature(point.min)} · máx. {formatTemperature(point.max)}
              </span>
            </p>
            {point.historical > 0 && (
              <p className="text-muted-foreground">
                {point.historical === point.readings ? 'Dado recuperado' : `${point.historical} de ${point.readings} leituras recuperadas`}
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}

export function TemperatureChart({
  coldUnitId,
  minTemperature,
  maxTemperature,
  offlineThresholdMinutes,
}: {
  coldUnitId: string
  minTemperature: number
  maxTemperature: number
  offlineThresholdMinutes: number
}) {
  const [range, setRange] = useState<(typeof RANGES)[number]>(RANGES[2])
  const series = useTemperatureSeries(coldUnitId, range.minutes, range.bucket)

  const buckets = useMemo(() => series.data?.buckets ?? [], [series.data])
  const allDevices = useMemo(() => buildChartDevices(buckets), [buckets])
  const devices = useMemo(() => allDevices.slice(0, MAX_CHART_DEVICES), [allDevices])
  const rows = useMemo(
    () => buildChartRows(buckets, devices, Math.max(range.bucket * 3, offlineThresholdMinutes)),
    [buckets, devices, range.bucket, offlineThresholdMinutes],
  )
  const yDomain = useMemo(() => buildYDomain(buckets, minTemperature, maxTemperature), [buckets, minTemperature, maxTemperature])

  const hasRecovered = useMemo(() => buckets.some((bucket) => bucket.historicalReadings > 0), [buckets])

  const formatTick = (value: number) => (range.minutes > 24 * 60 ? formatDay(value) : formatTime(value))

  // Marcas igualmente espaçadas: as automáticas seguem os dados e repetiam o mesmo dia
  const ticks = useMemo(() => {
    if (!series.data) return []
    const { start, end } = series.data
    return Array.from({ length: TICK_COUNT }, (_, index) => start + ((end - start) * index) / (TICK_COUNT - 1))
  }, [series.data])

  return (
    <div className="grid grid-cols-1 gap-3">
      <div role="group" aria-label="Período do gráfico" className="flex flex-wrap gap-1">
        {RANGES.map((option) => (
          <Button
            key={option.label}
            size="sm"
            variant={option.label === range.label ? 'default' : 'outline'}
            aria-pressed={option.label === range.label}
            onClick={() => setRange(option)}
          >
            {option.label}
          </Button>
        ))}
      </div>

      {series.isPending ? (
        <LoadingState label="Carregando gráfico..." />
      ) : series.isError && !series.data ? (
        <ErrorState error={series.error} onRetry={() => void series.refetch()} />
      ) : buckets.length === 0 ? (
        <EmptyState title="Sem leituras neste período" description="Escolha um período maior ou confira se a placa está enviando dados." />
      ) : (
        <>
          <div
            role="img"
            aria-label={`Temperatura da unidade no período de ${range.label}. A aba Leituras traz os mesmos dados em tabela.`}
            className={cn('h-72 w-full transition-opacity md:h-96', series.isPlaceholderData && 'opacity-60')}
          >
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={rows}
                margin={{ top: 8, right: 16, bottom: 0, left: -12 }}
              >
                <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
                <ReferenceArea y1={minTemperature} y2={maxTemperature} fill="var(--status-good)" fillOpacity={0.1} ifOverflow="extendDomain" />
                <XAxis
                  dataKey="time"
                  type="number"
                  scale="time"
                  domain={[series.data!.start, series.data!.end]}
                  ticks={ticks}
                  tickFormatter={formatTick}
                  tick={{ fontSize: 12, fill: 'var(--chart-label)' }}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--chart-axis)' }}
                  minTickGap={48}
                />
                <YAxis
                  domain={yDomain}
                  tick={{ fontSize: 12, fill: 'var(--chart-label)' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value: number) => `${value}°`}
                  width={48}
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                />
                <Tooltip
                  cursor={{ stroke: 'var(--chart-axis)' }}
                  content={({ active, payload }) => (
                    <ChartTooltip active={Boolean(active)} row={payload?.[0]?.payload as ChartRow | undefined} devices={devices} />
                  )}
                />
                {devices.length === 1 && (
                  <Area
                    dataKey="band"
                    stroke="none"
                    fill={seriesColor(devices[0]!)}
                    fillOpacity={0.15}
                    connectNulls={false}
                    isAnimationActive={false}
                    activeDot={false}
                    tooltipType="none"
                  />
                )}
                {devices.map((device) => (
                  <Line
                    key={device.id}
                    dataKey={(row: ChartRow) => row.line[device.id] ?? null}
                    name={device.macAddress}
                    stroke={seriesColor(device)}
                    strokeWidth={2}
                    connectNulls={false}
                    isAnimationActive={false}
                    activeDot={false}
                    dot={(props) => {
                      const { cx, cy, payload, index } = props as { cx?: number; cy?: number; payload: ChartRow; index: number }
                      const point = payload.points[device.id]
                      const previous = rows[index - 1]?.line[device.id]
                      const next = rows[index + 1]?.line[device.id]
                      const isolated = (previous ?? null) === null && (next ?? null) === null

                      if (cx === undefined || cy === undefined || !point || (!point.historical && !isolated)) {
                        return <g key={index} />
                      }

                      // Recuperado: marcador vazado. Sem vizinhos: ponto cheio, senão ficaria invisível.
                      return (
                        <circle
                          key={index}
                          cx={cx}
                          cy={cy}
                          r={4}
                          fill={point.historical ? 'var(--card)' : seriesColor(device)}
                          stroke={seriesColor(device)}
                          strokeWidth={2}
                        />
                      )
                    }}
                  />
                ))}
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {devices.length > 1 &&
              devices.map((device) => (
                <li key={device.id} className="flex items-center gap-1.5">
                  <span aria-hidden className="h-0.5 w-4 rounded-full" style={{ backgroundColor: seriesColor(device) }} />
                  <span className="font-mono">{device.macAddress}</span>
                </li>
              ))}
            <li className="flex items-center gap-1.5">
              <span aria-hidden className="size-3 rounded-sm bg-status-good/20" />
              Faixa segura ({formatTemperature(minTemperature)} a {formatTemperature(maxTemperature)})
            </li>
            {devices.length === 1 && (
              <li className="flex items-center gap-1.5">
                <span aria-hidden className="h-3 w-4 rounded-sm" style={{ backgroundColor: seriesColor(devices[0]!), opacity: 0.2 }} />
                Mínimo e máximo do intervalo
              </li>
            )}
            {hasRecovered && (
              <li className="flex items-center gap-1.5">
                <span aria-hidden className="size-2.5 rounded-full border-2 border-foreground/60" />
                Dado recuperado
              </li>
            )}
          </ul>

          {allDevices.length > MAX_CHART_DEVICES && (
            <p className="text-xs text-muted-foreground">
              O gráfico mostra {MAX_CHART_DEVICES} de {allDevices.length} placas. Consulte as demais na aba Leituras.
            </p>
          )}
        </>
      )}
    </div>
  )
}
