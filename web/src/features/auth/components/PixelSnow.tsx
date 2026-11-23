import { useEffect, useRef } from 'react'
import { usePrefersReducedMotion } from '@/shared/lib/media'
import { cn } from '@/shared/lib/utils'

// Cada pixel da arte ocupa CELL px de tela; o canvas é desenhado pequeno e ampliado sem suavização
const CELL = 4
const FPS = 24
// Área da arte, em pixels, para cada floco
const AREA_PER_FLAKE = 150

interface Flake {
  x: number
  y: number
  // Pixels da arte por segundo
  speed: number
  size: number
  alpha: number
  phase: number
}

// Os flocos mais próximos são maiores, mais rápidos e mais claros
function createFlake(width: number, y: number): Flake {
  const near = Math.random() < 0.08
  return {
    x: Math.random() * width,
    y,
    speed: near ? 9 + Math.random() * 4 : 3 + Math.random() * 4,
    size: near ? 2 : 1,
    alpha: near ? 0.7 : 0.2 + Math.random() * 0.35,
    phase: Math.random() * Math.PI * 2,
  }
}

// Neve em pixels caindo devagar, na cor do texto do elemento pai
export function PixelSnow({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const reducedMotion = usePrefersReducedMotion()

  useEffect(() => {
    // O jsdom dos testes não tem ResizeObserver nem canvas
    if (typeof ResizeObserver === 'undefined') return
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    let flakes: Flake[] = []
    let frame = 0
    let last = 0

    const draw = (time: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      for (const flake of flakes) {
        const drift = Math.sin(time / 1000 + flake.phase) * 1.5
        ctx.globalAlpha = flake.alpha
        ctx.fillRect(Math.round(flake.x + drift), Math.round(flake.y), flake.size, flake.size)
      }
    }

    // Mudar o tamanho do canvas apaga o desenho e o estilo, então tudo é refeito aqui
    const resize = () => {
      canvas.width = Math.ceil(canvas.clientWidth / CELL)
      canvas.height = Math.ceil(canvas.clientHeight / CELL)
      ctx.fillStyle = getComputedStyle(canvas).color
      const count = Math.round((canvas.width * canvas.height) / AREA_PER_FLAKE)
      flakes = Array.from({ length: count }, () => createFlake(canvas.width, Math.random() * canvas.height))
      draw(last)
    }

    const step = (time: number) => {
      frame = requestAnimationFrame(step)
      if (time - last < 1000 / FPS) return
      // Limita o passo para os flocos não saltarem quando a aba volta do segundo plano
      const elapsed = Math.min(time - last, 100) / 1000
      last = time
      for (const flake of flakes) {
        flake.y += flake.speed * elapsed
        if (flake.y > canvas.height) Object.assign(flake, createFlake(canvas.width, -flake.size))
      }
      draw(time)
    }

    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    if (!reducedMotion) frame = requestAnimationFrame(step)

    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [reducedMotion])

  return <canvas ref={ref} aria-hidden className={cn('[image-rendering:pixelated]', className)} />
}
