import { useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/shared/ui/dialog'
import { Field, NativeSelect } from '@/shared/ui/form'
import { Input } from '@/shared/ui/input'
import { ROLE_LABELS } from '@/shared/domain'
import { useCreateUser, useUpdateUser } from '../hooks'
import type { User } from '../types'

const editSchema = z.object({
  name: z.string().trim().min(1, 'Informe o nome.'),
  email: z.email('Informe um e-mail válido.'),
  role: z.enum(['MASTER', 'ADMIN', 'OPERATOR']),
  password: z.string(),
})

const createSchema = editSchema.refine((values) => values.password.length >= 8, {
  path: ['password'],
  message: 'A senha deve ter pelo menos 8 caracteres.',
})

type FormValues = z.infer<typeof editSchema>

export function UserFormDialog({
  user,
  enterpriseId,
  isSelf = false,
  defaultRole = 'OPERATOR',
  trigger,
}: {
  user?: User
  enterpriseId?: string | undefined
  isSelf?: boolean
  defaultRole?: 'ADMIN' | 'OPERATOR'
  trigger: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const create = useCreateUser()
  const update = useUpdateUser(enterpriseId)
  const isPending = create.isPending || update.isPending

  const { register, handleSubmit, reset, formState } = useForm<FormValues>({
    resolver: zodResolver(user ? editSchema : createSchema),
    defaultValues: {
      name: user?.name ?? '',
      email: user?.email ?? '',
      role: user?.role ?? defaultRole,
      password: '',
    },
  })

  const close = () => {
    setOpen(false)
    if (!user) reset()
  }

  const onSubmit = ({ name, email, role, password }: FormValues) => {
    if (user) update.mutate({ id: user.id, input: { name, email, role } }, { onSuccess: close })
    else create.mutate({ name, email, role, password, enterpriseId }, { onSuccess: close })
  }

  // Não dá para trocar o próprio perfil nem o de um MASTER por aqui: a API recusaria
  const lockRole = isSelf || user?.role === 'MASTER'

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) reset()
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{user ? 'Editar usuário' : 'Novo usuário'}</DialogTitle>
          <DialogDescription>
            {user ? 'A mudança de perfil vale a partir do próximo login da pessoa.' : 'Combine a senha inicial com a pessoa; ela pode trocá-la no perfil.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 gap-4" noValidate>
          <Field id="user-name" label="Nome" error={formState.errors.name?.message}>
            <Input id="user-name" autoComplete="off" {...register('name')} />
          </Field>
          <Field id="user-email" label="E-mail" error={formState.errors.email?.message}>
            <Input id="user-email" type="email" autoComplete="off" {...register('email')} />
          </Field>
          <Field id="user-role" label="Perfil de acesso" error={formState.errors.role?.message}>
            <NativeSelect id="user-role" disabled={lockRole} {...register('role')}>
              {user?.role === 'MASTER' && <option value="MASTER">{ROLE_LABELS.MASTER}</option>}
              <option value="OPERATOR">{ROLE_LABELS.OPERATOR}</option>
              <option value="ADMIN">{ROLE_LABELS.ADMIN}</option>
            </NativeSelect>
          </Field>
          {!user && (
            <Field id="user-password" label="Senha inicial" error={formState.errors.password?.message}>
              <Input id="user-password" type="password" autoComplete="new-password" {...register('password')} />
            </Field>
          )}
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
