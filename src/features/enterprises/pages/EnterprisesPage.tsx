import { Plus } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { formatDateTime } from '@/shared/lib/format'
import { Button } from '@/shared/ui/button'
import { EmptyState, ErrorState, LoadingState, PageHeader } from '@/shared/ui/page'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { EnterpriseFormDialog } from '../components/EnterpriseFormDialog'
import { useEnterprises } from '../hooks'

export default function EnterprisesPage() {
  const enterprises = useEnterprises()
  const navigate = useNavigate()

  return (
    <>
      <PageHeader
        title="Empresas"
        description="Clientes atendidos pela plataforma."
        actions={
          <EnterpriseFormDialog
            onCreated={(enterprise) => void navigate(`/empresas/${enterprise.id}`)}
            trigger={
              <Button>
                <Plus aria-hidden />
                Nova empresa
              </Button>
            }
          />
        }
      />

      {enterprises.isPending ? (
        <LoadingState />
      ) : enterprises.isError ? (
        <ErrorState error={enterprises.error} onRetry={() => void enterprises.refetch()} />
      ) : enterprises.data.length === 0 ? (
        <EmptyState title="Nenhuma empresa cadastrada" />
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>CNPJ</TableHead>
                <TableHead>Criada em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {enterprises.data.map((enterprise) => (
                <TableRow key={enterprise.id}>
                  <TableCell>
                    <Link to={`/empresas/${enterprise.id}`} className="font-medium underline-offset-2 hover:underline">
                      {enterprise.name}
                    </Link>
                  </TableCell>
                  <TableCell className="tabular-nums">{enterprise.cnpj}</TableCell>
                  <TableCell className="tabular-nums">{formatDateTime(enterprise.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  )
}
