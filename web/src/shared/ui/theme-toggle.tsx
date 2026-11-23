import { useId } from 'react'
import { setTheme, useTheme } from '@/shared/lib/theme'
import { cn } from '@/shared/lib/utils'

// Raios do sol: 8 traços que vão do raio 7 ao 9,5 a partir do centro
const RAYS = Array.from({ length: 8 }, (_, i) => {
  const angle = (i * Math.PI) / 4
  const point = (radius: number) => [12 + radius * Math.cos(angle), 12 + radius * Math.sin(angle)].map((n) => Math.round(n * 100) / 100)
  const [x1, y1] = point(7)
  const [x2, y2] = point(9.5)
  return { x1, y1, x2, y2 }
})

const MOTION = 'duration-500 ease-in-out motion-reduce:transition-none'

// Sol que vira lua: os raios recolhem girando, o círculo cresce e uma sombra desliza sobre ele,
// recortando a lua crescente. Na volta, a ordem se inverte.
function SunMoonIcon({ dark }: { dark: boolean }) {
  const maskId = useId()

  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-5">
      <mask id={maskId}>
        <rect width="24" height="24" fill="white" />
        <circle
          cx="24"
          cy="0"
          r="8"
          fill="black"
          className={cn('transition-[translate]', MOTION, dark && 'translate-x-[-7px] translate-y-[7px] delay-150')}
        />
      </mask>
      <circle
        cx="12"
        cy="12"
        r="8"
        fill="currentColor"
        mask={`url(#${maskId})`}
        className={cn('origin-center transition-[scale] [transform-box:fill-box]', MOTION, dark ? 'scale-100 delay-150' : 'scale-[0.55]')}
      />
      <g
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        className={cn(
          'origin-center transition-[opacity,scale,rotate] [transform-box:fill-box]',
          MOTION,
          dark ? 'scale-50 rotate-90 opacity-0' : 'delay-150',
        )}
      >
        {RAYS.map((ray) => (
          <line key={`${ray.x2},${ray.y2}`} {...ray} />
        ))}
      </g>
    </svg>
  )
}

export function ThemeToggle({ className }: { className?: string }) {
  const dark = useTheme() === 'dark'

  return (
    <button
      type="button"
      aria-label="Tema escuro"
      aria-pressed={dark}
      title={dark ? 'Mudar para o tema claro' : 'Mudar para o tema escuro'}
      onClick={() => setTheme(dark ? 'light' : 'dark')}
      className={cn(
        'inline-flex size-10 shrink-0 items-center justify-center rounded-full transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
        className,
      )}
    >
      <SunMoonIcon dark={dark} />
    </button>
  )
}
