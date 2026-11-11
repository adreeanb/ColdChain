import { screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { setToken } from '@/shared/api/client'
import { API, server } from '@/test/server'
import { renderRoutes } from '@/test/utils'
import { RequireAuth, RequireRole } from './guards'

const me = (role: string) => http.get(`${API}/me`, () => HttpResponse.json({ id: '1', name: 'Ana', email: 'a@a.com', role, enterpriseId: 'e1', createdAt: '' }))

const routes = [
  { path: '/login', element: <p>tela de login</p> },
  {
    element: <RequireAuth />,
    children: [
      { path: '/', element: <p>área logada</p> },
      {
        element: <RequireRole roles={['ADMIN', 'MASTER']} />,
        children: [{ path: '/usuarios', element: <p>tela de usuários</p> }],
      },
    ],
  },
]

describe('guardas de acesso', () => {
  it('sem token, manda para o login', async () => {
    renderRoutes(routes)
    expect(await screen.findByText('tela de login')).toBeInTheDocument()
  })

  it('com sessão válida, abre a página', async () => {
    setToken('token')
    server.use(me('OPERATOR'))
    renderRoutes(routes)
    expect(await screen.findByText('área logada')).toBeInTheDocument()
  })

  it('OPERATOR não abre página de administrador', async () => {
    setToken('token')
    server.use(me('OPERATOR'))
    renderRoutes(routes, '/usuarios')
    expect(await screen.findByText('Acesso negado')).toBeInTheDocument()
    expect(screen.queryByText('tela de usuários')).not.toBeInTheDocument()
  })

  it('ADMIN abre página de administrador', async () => {
    setToken('token')
    server.use(me('ADMIN'))
    renderRoutes(routes, '/usuarios')
    expect(await screen.findByText('tela de usuários')).toBeInTheDocument()
  })

  it('token expirado (401) limpa a sessão e volta ao login', async () => {
    setToken('vencido')
    server.use(http.get(`${API}/me`, () => HttpResponse.json({ error: 'Token inválido ou expirado.' }, { status: 401 })))
    renderRoutes(routes)
    expect(await screen.findByText('tela de login')).toBeInTheDocument()
    expect(localStorage.getItem('coldchain.token')).toBeNull()
  })

  it('usuário excluído (404 no /me) também perde a sessão', async () => {
    setToken('token')
    server.use(http.get(`${API}/me`, () => HttpResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 })))
    renderRoutes(routes)
    expect(await screen.findByText('tela de login')).toBeInTheDocument()
  })

  it('API fora do ar não derruba a sessão: mostra o erro e permite tentar de novo', async () => {
    setToken('token')
    server.use(http.get(`${API}/me`, () => HttpResponse.json({ error: 'Erro interno.' }, { status: 500 })))
    renderRoutes(routes)
    expect(await screen.findByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument()
    expect(localStorage.getItem('coldchain.token')).toBe('token')
  })
})
