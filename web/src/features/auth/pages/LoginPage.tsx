import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Navigate, useLocation } from 'react-router'
import { z } from 'zod'
import { getErrorMessage } from '@/shared/api/client'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Field } from '@/shared/ui/form'
import { Input } from '@/shared/ui/input'
import { ThemeToggle } from '@/shared/ui/theme-toggle'
import { LoginShowcase } from '../components/LoginShowcase'
import { PixelSnow } from '../components/PixelSnow'
import { useAuth } from '../hooks'

const schema = z.object({
  email: z.email('Informe um e-mail válido.'),
  password: z.string().min(1, 'Informe a senha.'),
})

type FormValues = z.infer<typeof schema>

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
    <main className="relative grid min-h-dvh overflow-hidden bg-linear-to-br from-primary to-[color-mix(in_srgb,var(--primary)_65%,black)] text-primary-foreground dark:from-[color-mix(in_srgb,var(--primary)_35%,var(--background))] dark:to-[color-mix(in_srgb,var(--background)_70%,black)] lg:grid-cols-2">
      <PixelSnow className="absolute inset-0 size-full" />
      <ThemeToggle className="absolute top-4 right-4 z-10 bg-primary-foreground/10 text-primary-foreground ring-1 ring-primary-foreground/20 backdrop-blur-md hover:bg-primary-foreground/20 focus-visible:ring-primary-foreground/60" />

      {/* pt-20 no celular para o card não encostar no botão de tema em telas baixas */}
      <div className="relative flex items-center justify-center px-6 pt-20 pb-6 lg:p-10">
        <div className="w-full max-w-md rounded-2xl bg-background p-8 text-foreground shadow-2xl sm:p-10">
          <div className="flex items-center gap-2.5">

          </div>

          <h1 className="mt-10 mb-8 text-3xl font-bold tracking-tight">Bem-vindo de volta</h1>

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
