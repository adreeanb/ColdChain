import { useState } from 'react'
import { useColdUnits } from '@/features/cold-units'
import { NativeSelect } from '@/shared/ui/form'
import { Label } from '@/shared/ui/label'
import { PageHeader } from '@/shared/ui/page'
import { AlertsPanel } from '../components/AlertsPanel'

export default function AlertsPage() {
  const [coldUnitId, setColdUnitId] = useState('')
  const units = useColdUnits()

  return (
    <>
      <PageHeader title="Alertas" description="Leituras fora dos limites configurados em cada unidade." />
      <AlertsPanel
        coldUnitId={coldUnitId || undefined}
        filters={
          <div className="flex items-center gap-2">
            <Label htmlFor="unit-filter" className="whitespace-nowrap">
              Unidade
            </Label>
            <NativeSelect id="unit-filter" value={coldUnitId} onChange={(event) => setColdUnitId(event.target.value)}>
              <option value="">Todas</option>
              {units.data?.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.name}
                </option>
              ))}
            </NativeSelect>
          </div>
        }
      />
    </>
  )
}
