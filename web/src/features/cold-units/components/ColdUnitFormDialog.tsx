import { useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { COLD_UNIT_TYPE_LABELS, type ColdUnitType } from '@/shared/domain'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/shared/ui/dialog'
import { Field, NativeSelect } from '@/shared/ui/form'
import { Input } from '@/shared/ui/input'
import { useSaveColdUnit } from '../hooks'
import type { ColdUnit } from '../types'

const temperature = z.number({ error: 'Informe um número.' })

const schema = z
  .object({
    name: z.string().trim().min(1, 'Informe o nome.'),
    type: z.enum(['COLD_ROOM', 'COLD_STORAGE', 'REEFER_TRUCK']),
    minTemperature: temperature,
    maxTemperature: temperature,
    licensePlate: z.string().trim(),
    location: z.string().trim(),
  })
  .refine((values) => values.minTemperature < values.maxTemperature, {
    path: ['maxTemperature'],
    message: 'A máxima deve ser maior que a mínima.',
  })

type FormValues = z.infer<typeof schema>

export function ColdUnitFormDialog({ unit, trigger }: { unit?: ColdUnit; trigger: ReactNode }) {
  const [open, setOpen] = useState(false)
  const save = useSaveColdUnit(unit?.id)

  const { register, handleSubmit, reset, watch, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: unit?.name ?? '',
      type: unit?.type ?? 'COLD_ROOM',
      ...(unit ? { minTemperature: unit.minTemperature, maxTemperature: unit.maxTemperature } : {}),
      licensePlate: unit?.licensePlate ?? '',
      location: unit?.location ?? '',
    },
  })

  const isTruck = watch('type') === 'REEFER_TRUCK'

  const onSubmit = (values: FormValues) => {
    save.mutate(
      {
        name: values.name,
        type: values.type,
        minTemperature: values.minTemperature,
        maxTemperature: values.maxTemperature,
        isFixedLocation: !isTruck,
        licensePlate: isTruck ? values.licensePlate || null : null,
        location: isTruck ? null : values.location || null,
      },
      {
        onSuccess: () => {
          setOpen(false)
          if (!unit) reset()
        },
      },
    )
  }

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
          <DialogTitle>{unit ? 'Editar unidade' : 'Nova unidade'}</DialogTitle>
          <DialogDescription>Leituras fora da faixa de temperatura geram alertas.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 gap-4" noValidate>
          <Field id="unit-name" label="Nome" error={formState.errors.name?.message}>
            <Input id="unit-name" {...register('name')} />
          </Field>
          <Field id="unit-type" label="Tipo" error={formState.errors.type?.message}>
            <NativeSelect id="unit-type" {...register('type')}>
              {(Object.keys(COLD_UNIT_TYPE_LABELS) as ColdUnitType[]).map((type) => (
                <option key={type} value={type}>
                  {COLD_UNIT_TYPE_LABELS[type]}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field id="unit-min" label="Mínima (°C)" error={formState.errors.minTemperature?.message}>
              <Input id="unit-min" type="number" step="any" inputMode="decimal" {...register('minTemperature', { valueAsNumber: true })} />
            </Field>
            <Field id="unit-max" label="Máxima (°C)" error={formState.errors.maxTemperature?.message}>
              <Input id="unit-max" type="number" step="any" inputMode="decimal" {...register('maxTemperature', { valueAsNumber: true })} />
            </Field>
          </div>
          {isTruck ? (
            <Field id="unit-plate" label="Placa do veículo (opcional)">
              <Input id="unit-plate" autoComplete="off" {...register('licensePlate')} />
            </Field>
          ) : (
            <Field id="unit-location" label="Localização (opcional)">
              <Input id="unit-location" autoComplete="off" {...register('location')} />
            </Field>
          )}
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
