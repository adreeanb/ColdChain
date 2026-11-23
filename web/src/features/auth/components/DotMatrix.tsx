import { cn } from '@/shared/lib/utils'
import { cellsPath } from './showcase'

// Vão entre os pontos, em fração da célula
const INSET = 0.125

interface DotMatrixProps {
  matrix: string[]
  // Tamanho de cada ponto em px de tela
  cell: number
  blink?: boolean
  className?: string
}

// Painel de LED: a cor vem de `currentColor`, e os pontos apagados ficam visíveis bem fracos
export function DotMatrix({ matrix, cell, blink = false, className }: DotMatrixProps) {
  const cols = matrix[0]?.length ?? 0

  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${cols} ${matrix.length}`}
      width={cols * cell}
      height={matrix.length * cell}
      className={cn('fill-current', className)}
    >
      <path d={cellsPath(matrix, '.', INSET)} className="opacity-10 dark:opacity-15" />
      <g className={cn(blink && 'motion-safe:animate-blink')}>
        <path d={cellsPath(matrix, ':', INSET)} className="opacity-45" />
        <path d={cellsPath(matrix, '#', INSET)} />
        <path d={cellsPath(matrix, '!', INSET)} className="fill-status-critical" />
      </g>
    </svg>
  )
}

export function PixelIcon({ sprite, className }: { sprite: string[]; className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${sprite[0].length} ${sprite.length}`}
      shapeRendering="crispEdges"
      className={cn('fill-current', className)}
    >
      <path d={cellsPath(sprite, '#')} />
    </svg>
  )
}
