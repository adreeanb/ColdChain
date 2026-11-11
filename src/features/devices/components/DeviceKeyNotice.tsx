import { useState } from 'react'
import { Check, Copy, KeyRound } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'

// A API só devolve a chave uma vez: depois disso o banco guarda apenas o hash
export function DeviceKeyNotice({ macAddress, deviceKey }: { macAddress: string; deviceKey: string }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(deviceKey)
      setCopied(true)
    } catch {
      // Sem permissão de área de transferência, a chave continua visível para copiar à mão
    }
  }

  return (
    <Alert>
      <KeyRound aria-hidden className="size-4" />
      <AlertTitle>Chave da placa {macAddress}</AlertTitle>
      <AlertDescription className="grid gap-2">
        <p>Grave esta chave no firmware (DEVICE_KEY em secrets.h). Ela não aparece de novo: se perder, gere outra na página da placa.</p>
        <div className="flex flex-wrap items-center gap-2">
          <code aria-label="Chave da placa" className="rounded bg-muted px-2 py-1 font-mono text-xs break-all text-foreground">
            {deviceKey}
          </code>
          <Button type="button" variant="outline" size="sm" onClick={() => void copy()}>
            {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
            {copied ? 'Copiada' : 'Copiar'}
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  )
}
