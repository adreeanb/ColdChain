import { useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/shared/ui/dialog'
import { Field } from '@/shared/ui/form'
import { Input } from '@/shared/ui/input'
import { useSaveEnterprise } from '../hooks'
import type { Enterprise } from '../types'

const schema = z.object({
  name: z.string().trim().min(1, 'Informe o nome.'),
  cnpj: z
    .string()
    .transform((value) => value.replace(/\D/g, ''))
    .refine((value) => value.length === 14, 'O CNPJ deve ter 14 dígitos.'),
})

type FormInput = z.input<typeof schema>
type FormOutput = z.output<typeof schema>

export function EnterpriseFormDialog({
  enterprise,
  trigger,
  onCreated,
}: {
  enterprise?: Enterprise
  trigger: ReactNode
  onCreated?: (enterprise: Enterprise) => void
}) {
  const [open, setOpen] = useState(false)
  const save = useSaveEnterprise(enterprise?.id)

  const { register, handleSubmit, reset, formState } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: { name: enterprise?.name ?? '', cnpj: enterprise?.cnpj ?? '' },
  })

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
          <DialogTitle>{enterprise ? 'Editar empresa' : 'Nova empresa'}</DialogTitle>
          <DialogDescription>{enterprise ? 'Os dados valem para toda a empresa.' : 'Depois de criar, cadastre o primeiro administrador e as placas.'}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={handleSubmit((values) =>
            save.mutate(values, {
              onSuccess: (saved) => {
                setOpen(false)
                if (!enterprise) {
                  reset()
                  onCreated?.(saved)
                }
              },
            }),
          )}
          className="grid grid-cols-1 gap-4"
          noValidate
        >
          <Field id="enterprise-name" label="Nome" error={formState.errors.name?.message}>
            <Input id="enterprise-name" autoComplete="off" {...register('name')} />
          </Field>
          <Field id="enterprise-cnpj" label="CNPJ" error={formState.errors.cnpj?.message}>
            <Input id="enterprise-cnpj" inputMode="numeric" autoComplete="off" {...register('cnpj')} />
          </Field>
          <DialogFooter>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
