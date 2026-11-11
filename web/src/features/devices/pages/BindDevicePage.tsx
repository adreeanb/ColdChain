import { useState } from 'react'
import { CircleCheck, TriangleAlert } from 'lucide-react'
import { Link, useSearchParams } from 'react-router'
import { useColdUnits } from '@/features/cold-units'
import { getErrorMessage } from '@/shared/api/client'
import { extractMacAddress, formatDateTime } from '@/shared/lib/format'
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Card, CardContent } from '@/shared/ui/card'
import { Field, NativeSelect } from '@/shared/ui/form'
import { Input } from '@/shared/ui/input'
import { ErrorState, LoadingState, PageHeader } from '@/shared/ui/page'
import { QrScanner } from '../components/QrScanner'
import { useBindDevice, useDevices, useUnboundDevices } from '../hooks'
import type { BindResult, QuarantineAction, UnboundDevice } from '../types'

const QUARANTINE_OPTIONS: { value: QuarantineAction; label: string; description: string }[] = [
  {
    value: 'recover',
    label: 'Recuperar para esta unidade',
    description: 'A placa já estava instalada aqui nesse período.',
  },
  {
    value: 'discard',
    label: 'Descartar',
    description: 'A placa estava fora da unidade, como na bancada ou em transporte. Evita dados e alertas falsos.',
  },
]

function QuarantineChoice({
  pending,
  value,
  onChange,
}: {
  pending: UnboundDevice
  value: QuarantineAction
  onChange: (value: QuarantineAction) => void
}) {
  const count = pending.pendingReadings === 1 ? '1 leitura' : `${pending.pendingReadings} leituras`

  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1 text-sm font-medium">Leituras na quarentena</legend>
      <p className="text-sm text-muted-foreground">
        A placa enviou {count} sem vínculo, de {formatDateTime(pending.firstReadingAt)} a {formatDateTime(pending.lastReadingAt)}.
      </p>
      {QUARANTINE_OPTIONS.map((option) => (
        <label
          key={option.value}
          className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 has-[:checked]:border-primary"
        >
          <input
            type="radio"
            name="bind-quarantine"
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
            className="mt-0.5 accent-primary"
          />
          <span className="grid gap-0.5">
            <span className="text-sm font-medium">{option.label}</span>
            <span className="text-xs text-muted-foreground">{option.description}</span>
          </span>
        </label>
      ))}
    </fieldset>
  )
}

function quarantineSummary({ recoveredReadings, discardedReadings }: BindResult) {
  const parts: string[] = []

  if (recoveredReadings === 1) parts.push('1 leitura da quarentena foi recuperada para esta unidade.')
  else if (recoveredReadings > 1) parts.push(`${recoveredReadings} leituras da quarentena foram recuperadas para esta unidade.`)

  if (discardedReadings === 1) parts.push('1 leitura da quarentena foi descartada.')
  else if (discardedReadings > 1) parts.push(`${discardedReadings} leituras da quarentena foram descartadas.`)

  return parts.length > 0 ? parts.join(' ') : 'Nenhuma leitura da quarentena precisou ser recuperada.'
}

function MacStep({ onConfirm }: { onConfirm: (mac: string) => void }) {
  const [manual, setManual] = useState('')
  const [manualError, setManualError] = useState<string | null>(null)
  const [scanError, setScanError] = useState(false)

  const submitManual = (event: React.FormEvent) => {
    event.preventDefault()
    const mac = extractMacAddress(manual)
    if (mac) onConfirm(mac)
    else setManualError('Informe um MAC válido, como AA:BB:CC:DD:EE:FF.')
  }

  return (
    <div className="grid justify-items-center gap-4 sm:justify-items-start">
      <QrScanner
        onScan={(text) => {
          const mac = extractMacAddress(text)
          if (mac) onConfirm(mac)
          else setScanError(true)
        }}
      />
      {scanError && (
        <p role="alert" className="text-sm font-medium text-destructive">
          Este QR Code não traz um MAC de placa. Tente outro ou digite abaixo.
        </p>
      )}
      <form onSubmit={submitManual} className="grid w-full max-w-sm gap-3" noValidate>
        <Field id="bind-mac" label="Ou digite o MAC impresso na placa" error={manualError ?? undefined}>
          <Input
            id="bind-mac"
            value={manual}
            onChange={(event) => {
              setManual(event.target.value)
              setManualError(null)
            }}
            placeholder="AA:BB:CC:DD:EE:FF"
            autoComplete="off"
            spellCheck={false}
            className="font-mono"
          />
        </Field>
        <Button type="submit" variant="outline" className="justify-self-start">
          Continuar
        </Button>
      </form>
    </div>
  )
}

function UnitStep({
  mac,
  initialUnitId,
  onBack,
  onDone,
}: {
  mac: string
  initialUnitId: string
  onBack: () => void
  onDone: (result: BindResult, unitId: string, alreadyBound: boolean) => void
}) {
  const units = useColdUnits()
  const devices = useDevices()
  const unbound = useUnboundDevices()
  const bind = useBindDevice()
  const [coldUnitId, setColdUnitId] = useState(initialUnitId)
  const [quarantine, setQuarantine] = useState<QuarantineAction>('recover')

  if (units.isPending || devices.isPending) return <LoadingState />
  if (units.isError) return <ErrorState error={units.error} onRetry={() => void units.refetch()} />

  // A checagem de posse é da API. Esta consulta serve só para avisar sobre o vínculo atual.
  const current = devices.data?.find((device) => device.macAddress === mac)?.associations[0]?.coldUnit
  const isSameUnit = current?.id === coldUnitId
  const pending = unbound.data?.find((device) => device.macAddress === mac)

  return (
    <div className="grid max-w-md gap-4">
      <div>
        <p className="text-sm text-muted-foreground">Placa</p>
        <p className="font-mono text-lg font-medium">{mac}</p>
      </div>

      <Field id="bind-unit" label="Unidade onde a placa foi instalada">
        <NativeSelect id="bind-unit" value={coldUnitId} onChange={(event) => setColdUnitId(event.target.value)}>
          <option value="">Selecione</option>
          {units.data.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {unit.name}
            </option>
          ))}
        </NativeSelect>
      </Field>

      {current && !isSameUnit && (
        <Alert>
          <TriangleAlert aria-hidden className="size-4" />
          <AlertTitle>Esta placa está em "{current.name}"</AlertTitle>
          <AlertDescription>Ao confirmar, esse vínculo é encerrado. As leituras antigas continuam naquela unidade.</AlertDescription>
        </Alert>
      )}

      {pending && !isSameUnit && <QuarantineChoice pending={pending} value={quarantine} onChange={setQuarantine} />}

      {bind.isError && (
        <Alert variant="destructive">
          <AlertDescription>{getErrorMessage(bind.error)}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          disabled={!coldUnitId || bind.isPending}
          onClick={() =>
            bind.mutate(
              { macAddress: mac, coldUnitId, quarantine },
              { onSuccess: (result) => onDone(result, coldUnitId, isSameUnit) },
            )
          }
        >
          {bind.isPending ? 'Vinculando...' : 'Confirmar vínculo'}
        </Button>
        <Button variant="ghost" onClick={onBack}>
          Trocar placa
        </Button>
      </div>
    </div>
  )
}

export default function BindDevicePage() {
  const [params] = useSearchParams()
  const initialMac = extractMacAddress(params.get('mac') ?? '')
  const [mac, setMac] = useState<string | null>(initialMac)
  const [done, setDone] = useState<{ result: BindResult; unitId: string; alreadyBound: boolean } | null>(null)

  const restart = () => {
    setMac(null)
    setDone(null)
  }

  return (
    <>
      <PageHeader title="Vincular placa" description="Leia o QR Code da placa e informe onde ela foi instalada." />
      <Card className="max-w-2xl">
        <CardContent>
          {done ? (
            <div className="grid grid-cols-1 gap-3">
              <p className="flex items-center gap-2 font-medium">
                <CircleCheck aria-hidden className="size-5 text-status-good" />
                {done.alreadyBound ? 'A placa já estava vinculada a esta unidade' : 'Placa vinculada'}
              </p>
              <p className="text-sm text-muted-foreground">{quarantineSummary(done.result)}</p>
              <div className="flex flex-wrap gap-2">
                <Button asChild>
                  <Link to={`/unidades/${done.unitId}`}>Ver unidade</Link>
                </Button>
                <Button variant="outline" onClick={restart}>
                  Vincular outra placa
                </Button>
              </div>
            </div>
          ) : mac ? (
            <UnitStep
              mac={mac}
              initialUnitId={params.get('unidade') ?? ''}
              onBack={() => setMac(null)}
              onDone={(result, unitId, alreadyBound) => setDone({ result, unitId, alreadyBound })}
            />
          ) : (
            <MacStep onConfirm={setMac} />
          )}
        </CardContent>
      </Card>
    </>
  )
}
