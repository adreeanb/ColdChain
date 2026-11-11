import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { BellRing, QrCode, Snowflake } from 'lucide-react'
import { Navigate, useLocation } from 'react-router'
import { z } from 'zod'
import { getErrorMessage } from '@/shared/api/client'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Field } from '@/shared/ui/form'
import { Input } from '@/shared/ui/input'
import { useAuth } from '../hooks'

const schema = z.object({
  email: z.email('Informe um e-mail válido.'),
  password: z.string().min(1, 'Informe a senha.'),
})

type FormValues = z.infer<typeof schema>

const highlights = [
  { icon: Snowflake, text: 'Leituras de temperatura ao vivo' },
  { icon: BellRing, text: 'Alertas quando uma unidade sai da faixa' },
  { icon: QrCode, text: 'Cadastro de placas por QR code' },
]

// Painel decorativo da direita, visível só em telas largas
function LoginShowcase() {
  return (
    <aside className="relative hidden overflow-hidden bg-linear-to-br from-primary to-[color-mix(in_srgb,var(--primary)_65%,black)] text-primary-foreground lg:flex lg:items-center lg:justify-center">
      <svg aria-hidden className="absolute inset-0 size-full opacity-10">
        <defs>
          <pattern id="login-hexagons" width="56" height="100" patternUnits="userSpaceOnUse">
            <path d="M28 66 0 50V16L28 0l28 16v34L28 66v34" fill="none" stroke="currentColor" strokeWidth="1.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#login-hexagons)" />
      </svg>

      <div className="relative max-w-md p-10">
        <span className="mb-8 flex size-24 items-center justify-center rounded-2xl bg-card shadow-lg">
          <img src="/logo.png" alt="" className="size-16 object-contain" />
        </span>
        <h2 className="text-3xl font-semibold tracking-tight">Cadeia fria sob controle</h2>
        <p className="mt-3 text-primary-foreground/80">
          Acompanhe a temperatura das suas unidades em tempo real e saiba na hora quando algo precisa de atenção.
        </p>
        <ul className="mt-8 grid gap-4">
          {highlights.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-lg bg-primary-foreground/15">
                <Icon aria-hidden className="size-4" />
              </span>
              {text}
            </li>
          ))}
        </ul>
      </div>
    </aside>
  )
}

export default function LoginPage() {
  const { user, signIn } = useAuth()
  const location = useLocation()
  const [error, setError] = useState<string | null>(null)
  const { register, handleSubmit, formState } = useForm<FormValues>({ resolver: zodResolver(schema) })

  if (user) {
    const from = (location.state as { from?: string } | null)?.from
    return <Navigate to={from ?? '/'} replace />
  }

  const onSubmit = async (values: FormValues) => {
    setError(null)
    try {
      await signIn(values.email, values.password)
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }

  return (
    <main className="grid min-h-dvh lg:grid-cols-2">
      <div className="flex flex-col p-6 lg:p-10">
        <div className="flex items-center gap-2.5">
          <img src="/logo.png" alt="" className="size-9 object-contain" />
          <span className="text-lg font-semibold">TCColdChain</span>
        </div>

        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <h1 className="text-3xl font-bold tracking-tight">Bem-vindo de volta</h1>
          <p className="mt-2 mb-8 text-sm text-muted-foreground">Acompanhe a temperatura das suas unidades frias.</p>

          <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 gap-5" noValidate>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Field id="email" label="E-mail" error={formState.errors.email?.message}>
              <Input id="email" type="email" autoComplete="username" autoFocus className="h-11" {...register('email')} />
            </Field>
            <Field id="password" label="Senha" error={formState.errors.password?.message}>
              <Input id="password" type="password" autoComplete="current-password" className="h-11" {...register('password')} />
            </Field>
            <Button type="submit" disabled={formState.isSubmitting} className="mt-2 h-11">
              {formState.isSubmitting ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>
          <p className="mt-8 text-center text-sm text-muted-foreground">Sem acesso? Peça o seu cadastro ao administrador da sua empresa.</p>
        </div>
      </div>

      <LoginShowcase />
    </main>
  )
}
