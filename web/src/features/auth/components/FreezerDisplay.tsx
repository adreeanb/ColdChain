import { useEffect, useState } from 'react'
import { COLD_UNIT_TYPE_LABELS } from '@/shared/domain'
import { formatTemperature } from '@/shared/lib/format'
import { usePrefersReducedMotion } from '@/shared/lib/media'
import { cn } from '@/shared/lib/utils'
import { UnitStatusBadge } from '@/shared/ui/unit-status-badge'
import { DotMatrix } from './DotMatrix'
import { DEMO_RANGE, DEMO_READINGS, formatDisplayTemperature, sparklineMatrix, textToMatrix } from './showcase'

const TICK_MS = 1500
// Começa poucas leituras antes da subida, para o alerta aparecer nos primeiros segundos
const START_INDEX = 20
// Sem animação, mostra o fim do ciclo: o gráfico guarda o alerta e a leitura atual está normal
const STATIC_INDEX = DEMO_READINGS.length - 1
const SCALE = { top: -12, bottom: -19.5, rows: 9, limit: DEMO_RANGE.max }
// Menos colunas que o ciclo, para o alerta anterior já ter saído do gráfico quando o próximo começa
const HISTORY_LENGTH = 40

// Display de uma câmara fria fictícia, com a temperatura ao vivo e as últimas leituras
export function FreezerDisplay() {
  const reducedMotion = usePrefersReducedMotion()
  const [tick, setTick] = useState(START_INDEX)

  useEffect(() => {
    if (reducedMotion) return
    const id = setInterval(() => setTick((value) => value + 1), TICK_MS)
    return () => clearInterval(id)
  }, [reducedMotion])

  const length = DEMO_READINGS.length
  const index = (reducedMotion ? STATIC_INDEX : tick) % length
  const value = DEMO_READINGS[index]
  // A leitura atual fica na última coluna
  const history = Array.from({ length: HISTORY_LENGTH }, (_, i) => DEMO_READINGS[(index - HISTORY_LENGTH + 1 + i + length) % length])
  const outOfRange = value > DEMO_RANGE.max || value < DEMO_RANGE.min

  // Tema claro: display LCD (tela clara, pontos escuros, sem brilho). Tema escuro: LED aceso.
  // Tudo por classes dark:, então trocar o tema não re-renderiza nem roda JS.
  return (
    <div
      aria-hidden
      className="rounded-2xl bg-card p-6 text-card-foreground shadow-2xl ring-1 ring-black/5 dark:bg-[color-mix(in_srgb,var(--primary)_14%,black)] dark:text-primary-foreground dark:ring-primary-foreground/10"
    >
      <div className="flex items-center justify-between font-mono text-xs tracking-widest text-muted-foreground uppercase dark:text-primary-foreground/60">
        <span>{COLD_UNIT_TYPE_LABELS.COLD_ROOM} 02</span>
        <span className="flex items-center gap-2">
          <span className="size-1.5 bg-current motion-safe:animate-blink" />
          Ao vivo
        </span>
      </div>

      <div className="mt-6 rounded-lg bg-[#dfe7ee] p-3 shadow-[inset_0_1px_4px_rgb(0_0_0/0.18)] dark:bg-transparent dark:p-0 dark:shadow-none">
        <div className={cn('flex justify-end', outOfRange ? 'text-status-critical' : 'text-foreground dark:text-primary-foreground')}>
          <DotMatrix
            matrix={textToMatrix(formatDisplayTemperature(value))}
            cell={8}
            blink={outOfRange}
            className="dark:drop-shadow-[0_0_6px_currentColor]"
          />
        </div>

        <DotMatrix
          matrix={sparklineMatrix(history, SCALE)}
          cell={6}
          className="mt-6 h-auto w-full text-foreground/80 dark:text-primary-foreground/85"
        />
      </div>

      <div className="mt-5 flex items-center justify-between gap-4">
        <UnitStatusBadge status={outOfRange ? 'OUT_OF_RANGE' : 'NORMAL'} />
        <span className="text-xs text-muted-foreground dark:text-primary-foreground/60">
          Faixa {formatTemperature(DEMO_RANGE.min)} a {formatTemperature(DEMO_RANGE.max)}
        </span>
      </div>
    </div>
  )
}
