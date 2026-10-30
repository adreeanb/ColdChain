import { PageHeader } from '@/shared/ui/page'
import { UsersManager } from '../components/UsersManager'

export default function UsersPage() {
  return (
    <>
      <PageHeader title="Usuários" description="Pessoas com acesso à sua empresa." />
      <UsersManager />
    </>
  )
}
