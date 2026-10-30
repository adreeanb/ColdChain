import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { API, server } from '@/test/server'
import { renderRoutes } from '@/test/utils'
import LoginPage from './LoginPage'

const routes = [
  { path: '/login', element: <LoginPage /> },
  { path: '/', element: <p>área logada</p> },
]

async function submit(email: string, password: string) {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText('E-mail'), email)
  await user.type(screen.getByLabelText('Senha'), password)
  await user.click(screen.getByRole('button', { name: 'Entrar' }))
}

describe('LoginPage', () => {
  it('valida os campos antes de chamar a API', async () => {
    renderRoutes(routes, '/login')
    await submit('invalido', 'x')
    expect(await screen.findByText('Informe um e-mail válido.')).toBeInTheDocument()
  })

  it('mostra a mensagem da API quando a senha está errada e continua na tela', async () => {
    server.use(http.post(`${API}/login`, () => HttpResponse.json({ error: 'Usuário ou senha incorretos.' }, { status: 401 })))
    renderRoutes(routes, '/login')
    await submit('ana@teste.com', 'errada')
    expect(await screen.findByText('Usuário ou senha incorretos.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeEnabled()
  })

  it('guarda o token e entra', async () => {
    server.use(
      http.post(`${API}/login`, () => HttpResponse.json({ id: '1', name: 'Ana', email: 'ana@teste.com', role: 'ADMIN', token: 'abc' })),
      http.get(`${API}/me`, ({ request }) => {
        expect(request.headers.get('Authorization')).toBe('Bearer abc')
        return HttpResponse.json({ id: '1', name: 'Ana', email: 'ana@teste.com', role: 'ADMIN', enterpriseId: 'e1', createdAt: '' })
      }),
    )
    renderRoutes(routes, '/login')
    await submit('ana@teste.com', 'senha-certa')
    expect(await screen.findByText('área logada')).toBeInTheDocument()
    expect(localStorage.getItem('coldchain.token')).toBe('abc')
  })

  it('mostra mensagem clara sem conexão', async () => {
    server.use(http.post(`${API}/login`, () => HttpResponse.error()))
    renderRoutes(routes, '/login')
    await submit('ana@teste.com', 'senha')
    expect(await screen.findByText(/Não foi possível conectar ao servidor/)).toBeInTheDocument()
  })
})
