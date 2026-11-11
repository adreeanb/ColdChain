import { useSearchParams } from 'react-router'
import { useEnterprises } from '@/features/enterprises'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card'
import { Field, NativeSelect } from '@/shared/ui/form'
import { EmptyState, ErrorState, LoadingState, PageHeader } from '@/shared/ui/page'
import { DeviceRegistrationForm } from '../components/DeviceRegistrationForm'
import { EnterpriseDevicesTable } from '../components/EnterpriseDevicesTable'

export default function RegisterDevicePage() {
  const enterprises = useEnterprises()
  const [params, setParams] = useSearchParams()

  // A empresa escolhida fica na URL: dá para chegar aqui já com ela pela tela da empresa
  const requested = params.get('empresa') ?? ''
  const enterprise = enterprises.data?.find((item) => item.id === requested)
  const enterpriseId = enterprise?.id ?? ''

  return (
    <>
      <PageHeader title="Cadastro de placas" description="Registre as placas ESP32 de cada empresa. Dados de placas não cadastradas são descartados." />

      {enterprises.isPending ? (
        <LoadingState />
      ) : enterprises.isError ? (
        <ErrorState error={enterprises.error} onRetry={() => void enterprises.refetch()} />
      ) : enterprises.data.length === 0 ? (
        <EmptyState title="Nenhuma empresa cadastrada" description="Crie uma empresa antes de cadastrar placas." />
      ) : (
        <div className="grid grid-cols-1 gap-6">
          <Card className="max-w-2xl">
            <CardHeader>
              <CardTitle>Nova placa</CardTitle>
              <CardDescription>Digite o MAC impresso na placa ou leia o QR Code da etiqueta.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4">
              <Field id="register-enterprise" label="Empresa dona da placa">
                <NativeSelect
                  id="register-enterprise"
                  value={enterpriseId}
                  onChange={(event) => setParams(event.target.value ? { empresa: event.target.value } : {}, { replace: true })}
                >
                  <option value="">Selecione</option>
                  {enterprises.data.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              {/* A key reinicia o formulário ao trocar de empresa */}
              <DeviceRegistrationForm key={enterpriseId} enterpriseId={enterpriseId} />
            </CardContent>
          </Card>

          {enterprise && (
            <section className="grid grid-cols-1 gap-3">
              <h2 className="font-medium">Placas de {enterprise.name}</h2>
              <EnterpriseDevicesTable enterpriseId={enterprise.id} />
            </section>
          )}
        </div>
      )}
    </>
  )
}
