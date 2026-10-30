import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useAuth } from '@/features/auth'
import { ROLE_LABELS } from '@/shared/domain'
import { Button } from '@/shared/ui/button'
import { ConfirmDialog } from '@/shared/ui/confirm-dialog'
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/page'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { useDeleteUser, useUsers } from '../hooks'
import { UserFormDialog } from './UserFormDialog'

// Sem enterpriseId, gerencia a empresa de quem está logado. O MASTER informa a empresa.
export function UsersManager({ enterpriseId }: { enterpriseId?: string }) {
  const { user: me } = useAuth()
  const users = useUsers(enterpriseId)
  const remove = useDeleteUser(enterpriseId)

  const canTouch = (role: string) => role !== 'MASTER' || me?.role === 'MASTER'

  return (
    <div className="grid grid-cols-1 gap-3">
      <div className="flex justify-end">
        <UserFormDialog
          enterpriseId={enterpriseId}
          {...(enterpriseId ? { defaultRole: 'ADMIN' as const } : {})}
          trigger={
            <Button size="sm">
              <Plus aria-hidden />
              Novo usuário
            </Button>
          }
        />
      </div>

      {users.isPending ? (
        <LoadingState />
      ) : users.isError ? (
        <ErrorState error={users.error} onRetry={() => void users.refetch()} />
      ) : users.data.length === 0 ? (
        <EmptyState title="Nenhum usuário cadastrado" description="Crie o primeiro administrador desta empresa." />
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Perfil</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.data.map((user) => {
                const isSelf = user.id === me?.id
                return (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      {user.name}
                      {isSelf && <span className="ml-1.5 text-xs font-normal text-muted-foreground">(você)</span>}
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{ROLE_LABELS[user.role]}</TableCell>
                    <TableCell className="text-right">
                      {canTouch(user.role) && (
                        <div className="flex justify-end gap-1">
                          <UserFormDialog
                            key={`${user.id}-${user.name}-${user.email}-${user.role}`}
                            user={user}
                            enterpriseId={enterpriseId}
                            isSelf={isSelf}
                            trigger={
                              <Button variant="ghost" size="icon" aria-label={`Editar ${user.name}`}>
                                <Pencil aria-hidden />
                              </Button>
                            }
                          />
                          {!isSelf && (
                            <ConfirmDialog
                              trigger={
                                <Button variant="ghost" size="icon" aria-label={`Remover ${user.name}`}>
                                  <Trash2 aria-hidden />
                                </Button>
                              }
                              title={`Remover ${user.name}?`}
                              description="A pessoa perde o acesso em até 1 dia, quando a sessão atual expirar. O e-mail continua reservado."
                              confirmLabel="Remover usuário"
                              onConfirm={() => remove.mutate(user.id)}
                            />
                          )}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
