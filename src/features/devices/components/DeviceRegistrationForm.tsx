import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { QrCode, X } from 'lucide-react'
import { z } from 'zod'
import { getErrorMessage } from '@/shared/api/client'
import { extractMacAddress } from '@/shared/lib/format'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Field } from '@/shared/ui/form'
import { Input } from '@/shared/ui/input'
import { useCreateDevice } from '../hooks'
import type { DeviceKey } from '../types'
import { DeviceKeyNotice } from './DeviceKeyNotice'
import { QrScanner } from './QrScanner'

const schema = z.object({
  macAddress: z.string().refine((value) => extractMacAddress(value) !== null, 'Informe um MAC válido, como AA:BB:CC:DD:EE:FF.'),
})

// Sem empresa, o formulário fica bloqueado. Depois de cadastrar, limpa o campo para a próxima placa.
export function DeviceRegistrationForm({ enterpriseId, onRegistered }: { enterpriseId: string; onRegistered?: () => void }) {
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState(false)
  // Fica na tela até o próximo cadastro, mesmo enquanto o MAC seguinte é digitado
  const [createdKey, setCreatedKey] = useState<DeviceKey | null>(null)
  const create = useCreateDevice()

  const { register, handleSubmit, reset, setValue, setFocus, formState } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { macAddress: '' },
  })

  const onSubmit = ({ macAddress }: { macAddress: string }) =>
    create.mutate(
      { macAddress, enterpriseId },
      {
        onSuccess: (device) => {
          setCreatedKey({ macAddress: device.macAddress, deviceKey: device.deviceKey })
          reset()
          // Depois do reset o formulário renderiza de novo; o foco precisa vir em seguida
          setTimeout(() => setFocus('macAddress'))
          onRegistered?.()
        },
      },
    )

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 gap-4" noValidate>
      {createdKey && <DeviceKeyNotice {...createdKey} />}

      {create.isError && (
        <Alert variant="destructive">
          <AlertDescription>{getErrorMessage(create.error)}</AlertDescription>
        </Alert>
      )}

      <Field id="device-mac" label="Endereço MAC" error={formState.errors.macAddress?.message}>
        <div className="flex gap-2">
          <Input
            id="device-mac"
            autoComplete="off"
            spellCheck={false}
            placeholder="AA:BB:CC:DD:EE:FF"
            className="font-mono"
            {...register('macAddress', { onChange: () => create.reset() })}
          />
          <Button
            type="button"
            variant="outline"
            aria-pressed={scanning}
            onClick={() => {
              setScanning(!scanning)
              setScanError(false)
            }}
          >
            {scanning ? <X aria-hidden /> : <QrCode aria-hidden />}
            {scanning ? 'Fechar câmera' : 'Ler QR Code'}
          </Button>
        </div>
      </Field>

      {scanning && (
        <div className="grid justify-items-center gap-2 sm:justify-items-start">
          <QrScanner
            onScan={(text) => {
              const mac = extractMacAddress(text)
              if (!mac) {
                setScanError(true)
                return
              }
              setValue('macAddress', mac, { shouldValidate: true })
              setScanning(false)
              setScanError(false)
              create.reset()
            }}
          />
          {scanError && (
            <p role="alert" className="text-sm font-medium text-destructive">
              Este QR Code não traz um MAC de placa.
            </p>
          )}
        </div>
      )}

      <Button type="submit" disabled={!enterpriseId || create.isPending} className="justify-self-start">
        {create.isPending ? 'Cadastrando...' : 'Cadastrar placa'}
      </Button>
    </form>
  )
}
