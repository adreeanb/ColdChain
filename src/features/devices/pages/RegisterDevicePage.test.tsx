import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { setToken } from '@/shared/api/client'
import { API, server } from '@/test/server'
import { renderRoutes } from '@/test/utils'
import RegisterDevicePage from './RegisterDevicePage'

const enterprises = [
  { id: 'e1', name: 'Frigorífico Norte', cnpj: '1', createdAt: '' },
  { id: 'e2', name: 'Laticínios Sul', cnpj: '2', createdAt: '' },
]

function mockApi() {
  const created: unknown[] = []
  server.use(
    http.get(`${API}/me`, () => HttpResponse.json({ id: '1', name: 'Master', email: 'm@m.com', role: 'MASTER', enterpriseId: 'e0', createdAt: '' })),
    http.get(`${API}/enterprises`, () => HttpResponse.json(enterprises)),
    http.get(`${API}/devices`, () => HttpResponse.json([])),
    http.post(`${API}/devices`, async ({ request }) => {
      const body = await request.json()
      created.push(body)
      return HttpResponse.json({ id: 'd1', ...(body as object) }, { status: 201 })
    }),
  )
  return created
}

const routes = [{ path: '/placas/cadastro', element: <RegisterDevicePage /> }]

beforeEach(() => setToken('token'))

describe('RegisterDevicePage', () => {
  it('sem empresa escolhida, não deixa cadastrar', async () => {
    mockApi()
    renderRoutes(routes, '/placas/cadastro')
    expect(await screen.findByRole('button', { name: 'Cadastrar placa' })).toBeDisabled()
  })

  it('chega com a empresa escolhida pela URL', async () => {
    mockApi()
    renderRoutes(routes, '/placas/cadastro?empresa=e2')
    expect(await screen.findByLabelText('Empresa dona da placa')).toHaveValue('e2')
    expect(screen.getByRole('heading', { name: 'Placas de Laticínios Sul' })).toBeInTheDocument()
  })

  it('MAC inválido não chama a API', async () => {
    const created = mockApi()
    const user = userEvent.setup()
    renderRoutes(routes, '/placas/cadastro?empresa=e1')
    await user.type(await screen.findByLabelText('Endereço MAC'), 'abc')
    await user.click(screen.getByRole('button', { name: 'Cadastrar placa' }))
    expect(await screen.findByText(/Informe um MAC válido/)).toBeInTheDocument()
    expect(created).toHaveLength(0)
  })

  it('cadastra na empresa escolhida e limpa o campo para a próxima placa', async () => {
    const created = mockApi()
    const user = userEvent.setup()
    renderRoutes(routes, '/placas/cadastro')
    await user.selectOptions(await screen.findByLabelText('Empresa dona da placa'), 'e1')
    const mac = screen.getByLabelText('Endereço MAC')
    await user.type(mac, 'aa:bb:cc:dd:ee:01')
    await user.click(screen.getByRole('button', { name: 'Cadastrar placa' }))

    await vi.waitFor(() => expect(mac).toHaveValue(''))
    expect(created).toEqual([{ macAddress: 'aa:bb:cc:dd:ee:01', enterpriseId: 'e1' }])
    await vi.waitFor(() => expect(mac).toHaveFocus())
  })

  it('mostra o erro da API, como MAC duplicado', async () => {
    mockApi()
    server.use(http.post(`${API}/devices`, () => HttpResponse.json({ error: 'Já existe uma placa cadastrada com este MAC.' }, { status: 400 })))
    const user = userEvent.setup()
    renderRoutes(routes, '/placas/cadastro?empresa=e1')
    await user.type(await screen.findByLabelText('Endereço MAC'), 'AA:BB:CC:DD:EE:01')
    await user.click(screen.getByRole('button', { name: 'Cadastrar placa' }))
    expect(await screen.findByText('Já existe uma placa cadastrada com este MAC.')).toBeInTheDocument()
  })

  it('o leitor de QR Code avisa quando não há câmera', async () => {
    mockApi()
    const user = userEvent.setup()
    renderRoutes(routes, '/placas/cadastro?empresa=e1')
    await user.click(await screen.findByRole('button', { name: 'Ler QR Code' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/Digite o MAC/)
  })
})
