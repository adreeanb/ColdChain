import { useMediaQuery } from '@/shared/lib/media'
import { PixelIcon } from './DotMatrix'
import { FreezerDisplay } from './FreezerDisplay'
import { SPRITES } from './showcase'

const highlights = [
  { sprite: SPRITES.snowflake, text: 'Leituras de temperatura ao vivo' },
  { sprite: SPRITES.bell, text: 'Alertas quando uma unidade sai da faixa' },
  { sprite: SPRITES.qrCode, text: 'Cadastro de placas por QR code' },
]

// Display e destaques da metade direita, sobre o fundo animado da página.
// Só existe em telas largas, para o display não rodar escondido no celular.
export function LoginShowcase() {
  const wide = useMediaQuery('(min-width: 64rem)')
  if (!wide) return null

  return (
    <aside className="relative hidden lg:flex lg:items-center lg:justify-center">
      <div className="relative w-full max-w-[30rem] p-10">
        <FreezerDisplay />
        {/* Vidro fosco: sem ele, os flocos entre as letras parecem pontuação */}
        <ul className="mt-6 grid gap-4 rounded-2xl bg-primary-foreground/10 p-5 ring-1 ring-primary-foreground/15 backdrop-blur-md">
          {highlights.map(({ sprite, text }) => (
            <li key={text} className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-lg bg-primary-foreground/15">
                <PixelIcon sprite={sprite} className="size-[18px]" />
              </span>
              {text}
            </li>
          ))}
        </ul>
      </div>
    </aside>
  )
}
