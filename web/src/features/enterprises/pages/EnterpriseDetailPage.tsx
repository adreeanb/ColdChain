import { ArrowLeft, Pencil, Trash2 } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router'
import { useAuth } from '@/features/auth'
import { DevicesManager } from '@/features/devices'
import { UsersManager } from '@/features/users'
import { Button } from '@/shared/ui/button'
import { ConfirmDialog } from '@/shared/ui/confirm-dialog'
import { ErrorState, LoadingState, PageHeader } from '@/shared/ui/page'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { EnterpriseFormDialog } from '../components/EnterpriseFormDialog'
import { useDeleteEnterprise, useEnterprise } from '../hooks'

export default function EnterpriseDetailPage() {
  const { id = '' } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const enterprise = useEnterprise(id)
  const remove = useDeleteEnterprise()

  if (enterprise.isPending) return <LoadingState />
  if (enterprise.isError) return <ErrorState error={enterprise.error} onRetry={() => void enterprise.refetch()} />

  const { name, cnpj } = enterprise.data

  return (
    <>
      <Link to="/empresas" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft aria-hidden className="size-4" />
        Empresas
      </Link>
      <PageHeader
        title={name}
        description={`CNPJ ${cnpj}`}
        actions={
          <>
            <EnterpriseFormDialog
              key={`${name}-${cnpj}`}
              enterprise={enterprise.data}
              trigger={
                <Button variant="outline">
                  <Pencil aria-hidden />
                  Editar
                </Button>
              }
            />
            {id !== user?.enterpriseId && (
              <ConfirmDialog
                trigger={
                  <Button variant="outline">
                    <Trash2 aria-hidden />
                    Excluir
                  </Button>
                }
                title={`Excluir "${name}"?`}
                description="Os usuários perdem o acesso, as unidades são removidas das listas, os vínculos são encerrados e as placas são desativadas."
                confirmLabel="Excluir empresa"
                confirmationText={name}
                onConfirm={() => remove.mutate(id, { onSuccess: () => void navigate('/empresas') })}
              />
            )}
          </>
        }
      />

      <Tabs defaultValue="users" className="gap-4">
        <TabsList>
          <TabsTrigger value="users">Usuários</TabsTrigger>
          <TabsTrigger value="devices">Placas</TabsTrigger>
        </TabsList>
        <TabsContent value="users">
          <UsersManager enterpriseId={id} />
        </TabsContent>
        <TabsContent value="devices">
          <DevicesManager enterpriseId={id} />
        </TabsContent>
      </Tabs>
    </>
  )
}
