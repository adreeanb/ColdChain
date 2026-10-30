import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus } from 'lucide-react'
import { z } from 'zod'
import { extractMacAddress } from '@/shared/lib/format'
import { Button } from '@/shared/ui/button'
import { ConfirmDialog } from '@/shared/ui/confirm-dialog'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/shared/ui/dialog'
import { Field } from '@/shared/ui/form'
import { Input } from '@/shared/ui/input'
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/page'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { useCreateDevice, useDeactivateDevice, useDevices } from '../hooks'
import { DeviceSignal } from './DeviceSignal'

const schema = z.object({
  macAddress: z.string().refine((value) => extractMacAddress(value) !== null, 'Informe um MAC válido, como AA:BB:CC:DD:EE:FF.'),
})

// Usado pelo MASTER para gerenciar as placas de uma empresa
export function DevicesManager({ enterpriseId }: { enterpriseId: string }) {
  const [open, setOpen] = useState(false)
  const devices = useDevices({ enterpriseId, includeInactive: true })
  const create = useCreateDevice()
  const deactivate = useDeactivateDevice()

  const { register, handleSubmit, reset, formState } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { macAddress: '' },
  })

  return (
    <div className="grid grid-cols-1 gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Dados de placas não cadastradas são descartados.</p>
        <Dialog
          open={open}
          onOpenChange={(next) => {
            setOpen(next)
            if (!next) reset()
          }}
        >
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus aria-hidden />
              Cadastrar placa
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cadastrar placa</DialogTitle>
              <DialogDescription>A placa passa a pertencer a esta empresa.</DialogDescription>
            </DialogHeader>
            <form
              onSubmit={handleSubmit(({ macAddress }) =>
                create.mutate(
                  { macAddress, enterpriseId },
                  {
                    onSuccess: () => {
                      setOpen(false)
                      reset()
                    },
                  },
                ),
              )}
              className="grid grid-cols-1 gap-4"
              noValidate
            >
              <Field id="device-mac" label="Endereço MAC" error={formState.errors.macAddress?.message}>
                <Input id="device-mac" autoComplete="off" spellCheck={false} placeholder="AA:BB:CC:DD:EE:FF" className="font-mono" {...register('macAddress')} />
              </Field>
              <DialogFooter>
                <Button type="submit" disabled={create.isPending}>
                  {create.isPending ? 'Salvando...' : 'Cadastrar'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {devices.isPending ? (
        <LoadingState />
      ) : devices.isError && !devices.data ? (
        <ErrorState error={devices.error} onRetry={() => void devices.refetch()} />
      ) : devices.data.length === 0 ? (
        <EmptyState title="Nenhuma placa cadastrada" />
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>MAC</TableHead>
                <TableHead>Sinal</TableHead>
                <TableHead>Unidade atual</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {devices.data.map((device) => (
                <TableRow key={device.id}>
                  <TableCell className="font-mono text-xs">{device.macAddress}</TableCell>
                  <TableCell>
                    <DeviceSignal device={device} />
                  </TableCell>
                  <TableCell>{device.associations[0]?.coldUnit.name ?? 'Sem vínculo'}</TableCell>
                  <TableCell className="text-right">
                    {device.isActive && (
                      <ConfirmDialog
                        trigger={
                          <Button variant="outline" size="sm">
                            Desativar
                          </Button>
                        }
                        title={`Desativar a placa ${device.macAddress}?`}
                        description="O vínculo é encerrado, e os dados desta placa passam a ser descartados. O histórico é mantido. Esta ação não pode ser desfeita pelo sistema."
                        confirmLabel="Desativar placa"
                        onConfirm={() => deactivate.mutate(device.id)}
                      />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
