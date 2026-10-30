import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Thermometer } from 'lucide-react'
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
    <main className="flex min-h-dvh items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Thermometer aria-hidden className="size-5" />
          </span>
          <span className="text-lg font-semibold">ColdChain Monitor</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Entrar</h1>
        <p className="mt-1 mb-6 text-sm text-muted-foreground">Acompanhe a temperatura das suas unidades frias.</p>

        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 gap-4" noValidate>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Field id="email" label="E-mail" error={formState.errors.email?.message}>
            <Input id="email" type="email" autoComplete="username" autoFocus {...register('email')} />
          </Field>
          <Field id="password" label="Senha" error={formState.errors.password?.message}>
            <Input id="password" type="password" autoComplete="current-password" {...register('password')} />
          </Field>
          <Button type="submit" disabled={formState.isSubmitting} className="mt-2">
            {formState.isSubmitting ? 'Entrando...' : 'Entrar'}
          </Button>
        </form>
        <p className="mt-6 text-xs text-muted-foreground">Sem acesso? Peça o seu cadastro ao administrador da sua empresa.</p>
      </div>
    </main>
  )
}
