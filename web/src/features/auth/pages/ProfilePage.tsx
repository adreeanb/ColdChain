import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { z } from 'zod'
import { getErrorMessage } from '@/shared/api/client'
import { ROLE_LABELS } from '@/shared/domain'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card'
import { Field } from '@/shared/ui/form'
import { Input } from '@/shared/ui/input'
import { PageHeader } from '@/shared/ui/page'
import { changePassword, updateProfile } from '../api'
import { CURRENT_USER_KEY, useAuth } from '../hooks'

const profileSchema = z.object({
  name: z.string().trim().min(1, 'Informe o nome.'),
  email: z.email('Informe um e-mail válido.'),
})

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Informe a senha atual.'),
    newPassword: z.string().min(8, 'A nova senha deve ter pelo menos 8 caracteres.'),
    confirmation: z.string(),
  })
  .refine((values) => values.newPassword === values.confirmation, {
    path: ['confirmation'],
    message: 'As senhas não conferem.',
  })

export default function ProfilePage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const profileForm = useForm({
    resolver: zodResolver(profileSchema),
    values: { name: user?.name ?? '', email: user?.email ?? '' },
  })
  const passwordForm = useForm({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmation: '' },
  })

  const profile = useMutation({
    mutationFn: updateProfile,
    onSuccess: (data) => {
      queryClient.setQueryData(CURRENT_USER_KEY, data)
      toast.success('Dados atualizados.')
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const password = useMutation({
    mutationFn: changePassword,
    onSuccess: () => {
      passwordForm.reset()
      toast.success('Senha alterada.')
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  return (
    <>
      <PageHeader title="Meu perfil" description={user ? `Perfil de acesso: ${ROLE_LABELS[user.role]}` : undefined} />
      <div className="grid max-w-4xl gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Dados pessoais</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={profileForm.handleSubmit((values) => profile.mutate(values))} className="grid grid-cols-1 gap-4" noValidate>
              <Field id="name" label="Nome" error={profileForm.formState.errors.name?.message}>
                <Input id="name" autoComplete="name" {...profileForm.register('name')} />
              </Field>
              <Field id="email" label="E-mail" error={profileForm.formState.errors.email?.message}>
                <Input id="email" type="email" autoComplete="email" {...profileForm.register('email')} />
              </Field>
              <Button type="submit" disabled={profile.isPending} className="justify-self-start">
                Salvar
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Senha</CardTitle>
            <CardDescription>Use pelo menos 8 caracteres.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={passwordForm.handleSubmit(({ currentPassword, newPassword }) => password.mutate({ currentPassword, newPassword }))}
              className="grid grid-cols-1 gap-4"
              noValidate
            >
              <Field id="current" label="Senha atual" error={passwordForm.formState.errors.currentPassword?.message}>
                <Input id="current" type="password" autoComplete="current-password" {...passwordForm.register('currentPassword')} />
              </Field>
              <Field id="new" label="Nova senha" error={passwordForm.formState.errors.newPassword?.message}>
                <Input id="new" type="password" autoComplete="new-password" {...passwordForm.register('newPassword')} />
              </Field>
              <Field id="confirmation" label="Confirme a nova senha" error={passwordForm.formState.errors.confirmation?.message}>
                <Input id="confirmation" type="password" autoComplete="new-password" {...passwordForm.register('confirmation')} />
              </Field>
              <Button type="submit" disabled={password.isPending} className="justify-self-start">
                Alterar senha
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
