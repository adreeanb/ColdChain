import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/shared/ui/dialog'
import { DeviceRegistrationForm } from './DeviceRegistrationForm'
import { EnterpriseDevicesTable } from './EnterpriseDevicesTable'

// Usado pelo MASTER para gerenciar as placas de uma empresa
export function DevicesManager({ enterpriseId }: { enterpriseId: string }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="grid grid-cols-1 gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Dados de placas não cadastradas são descartados.{' '}
          <Link to={`/placas/cadastro?empresa=${enterpriseId}`} className="font-medium text-foreground underline-offset-2 hover:underline">
            Abrir a tela de cadastro
          </Link>
        </p>
        <Dialog open={open} onOpenChange={setOpen}>
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
            <DeviceRegistrationForm enterpriseId={enterpriseId} onRegistered={() => setOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <EnterpriseDevicesTable enterpriseId={enterpriseId} />
    </div>
  )
}
