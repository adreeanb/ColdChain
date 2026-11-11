import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { setToken } from '@/shared/api/client'
import { API, server } from '@/test/server'
import { renderRoutes } from '@/test/utils'
import BindDevicePage from './BindDevicePage'

const MAC = 'AA:BB:CC:DD:EE:FF'
const units = [
  { id: 'u1', name: 'Câmara 1' },
  { id: 'u2', name: 'Caminhão 2' },
]

function mockApi(currentUnit?: { id: string; name: string }, pendingReadings = 0) {
  server.use(
    http.get(`${API}/devices/unbound`, () =>
      HttpResponse.json(
        pendingReadings
          ? [{ deviceId: 'd1', macAddress: MAC, pendingReadings, firstReadingAt: '2026-11-08T10:00:00Z', lastReadingAt: '2026-11-08T11:00:00Z', nextExpirationAt: '2026-11-08T12:00:00Z' }]
          : [],
      ),
    ),
    http.get(`${API}/me`, () => HttpResponse.json({ id: '1', name: 'Ana', email: 'a@a.com', role: 'OPERATOR', enterpriseId: 'e1', createdAt: '' })),
    http.get(`${API}/cold-units`, () => HttpResponse.json(units)),
    http.get(`${API}/devices`, () =>
      HttpResponse.json([{ id: 'd1', macAddress: MAC, associations: currentUnit ? [{ id: 'a1', coldUnit: currentUnit }] : [] }]),
    ),
  )
}

const routes = [{ path: '/vincular', element: <BindDevicePage /> }]

beforeEach(() => setToken('token'))

describe('BindDevicePage', () => {
  it('sem câmera, explica e permite digitar o MAC', async () => {
    mockApi()
    renderRoutes(routes, '/vincular')
    expect(await screen.findByRole('alert')).toHaveTextContent(/Digite o MAC/)
    expect(screen.getByLabelText('Ou digite o MAC impresso na placa')).toBeInTheDocument()
  })

  it('recusa MAC inválido sem chamar a API', async () => {
    mockApi()
    const user = userEvent.setup()
    renderRoutes(routes, '/vincular')
    await user.type(await screen.findByLabelText('Ou digite o MAC impresso na placa'), 'abc')
    await user.click(screen.getByRole('button', { name: 'Continuar' }))
    expect(await screen.findByText(/Informe um MAC válido/)).toBeInTheDocument()
  })

  it('o MAC vindo da quarentena pula a leitura e mostra as leituras recuperadas', async () => {
    mockApi()
    let body: unknown
    server.use(
      http.post(`${API}/devices/bind`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ association: { id: 'a', coldUnitId: 'u1', startDate: '' }, recoveredReadings: 12, discardedReadings: 0 }, { status: 201 })
      }),
    )
    const user = userEvent.setup()
    renderRoutes(routes, `/vincular?mac=${encodeURIComponent(MAC)}`)

    const confirm = await screen.findByRole('button', { name: 'Confirmar vínculo' })
    expect(confirm).toBeDisabled()
    await user.selectOptions(screen.getByLabelText('Unidade onde a placa foi instalada'), 'u1')
    await user.click(confirm)

    expect(await screen.findByText(/12 leituras da quarentena foram recuperadas/)).toBeInTheDocument()
    expect(body).toEqual({ macAddress: MAC, coldUnitId: 'u1', quarantine: 'recover' })
  })

  it('permite descartar a quarentena de uma placa que mediu fora da unidade', async () => {
    mockApi(undefined, 30)
    let body: unknown
    server.use(
      http.post(`${API}/devices/bind`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ association: { id: 'a', coldUnitId: 'u1', startDate: '' }, recoveredReadings: 0, discardedReadings: 30 }, { status: 201 })
      }),
    )
    const user = userEvent.setup()
    renderRoutes(routes, `/vincular?mac=${encodeURIComponent(MAC)}&unidade=u1`)

    expect(await screen.findByText(/enviou 30 leituras sem vínculo/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Recuperar para esta unidade/)).toBeChecked()
    await user.click(screen.getByLabelText(/Descartar/))
    await user.click(screen.getByRole('button', { name: 'Confirmar vínculo' }))

    expect(await screen.findByText('30 leituras da quarentena foram descartadas.')).toBeInTheDocument()
    expect(body).toEqual({ macAddress: MAC, coldUnitId: 'u1', quarantine: 'discard' })
  })

  it('avisa quando a placa está em outra unidade', async () => {
    mockApi({ id: 'u2', name: 'Caminhão 2' })
    const user = userEvent.setup()
    renderRoutes(routes, `/vincular?mac=${encodeURIComponent(MAC)}`)
    await user.selectOptions(await screen.findByLabelText('Unidade onde a placa foi instalada'), 'u1')
    expect(screen.getByText('Esta placa está em "Caminhão 2"')).toBeInTheDocument()
  })

  it('não avisa ao reescanear na mesma unidade e informa que já estava vinculada', async () => {
    mockApi({ id: 'u1', name: 'Câmara 1' })
    server.use(http.post(`${API}/devices/bind`, () => HttpResponse.json({ association: { id: 'a', coldUnitId: 'u1', startDate: '' }, recoveredReadings: 0, discardedReadings: 0 }, { status: 201 })))
    const user = userEvent.setup()
    renderRoutes(routes, `/vincular?mac=${encodeURIComponent(MAC)}&unidade=u1`)
    const confirm = await screen.findByRole('button', { name: 'Confirmar vínculo' })
    expect(screen.queryByText(/Esta placa está em/)).not.toBeInTheDocument()
    await user.click(confirm)
    expect(await screen.findByText('A placa já estava vinculada a esta unidade')).toBeInTheDocument()
  })

  it('mostra o erro da API, como placa de outra empresa', async () => {
    mockApi()
    server.use(http.post(`${API}/devices/bind`, () => HttpResponse.json({ error: 'Placa não encontrada, desativada ou não pertence à sua empresa.' }, { status: 400 })))
    const user = userEvent.setup()
    renderRoutes(routes, `/vincular?mac=${encodeURIComponent(MAC)}&unidade=u1`)
    await user.click(await screen.findByRole('button', { name: 'Confirmar vínculo' }))
    expect(await screen.findByText(/não pertence à sua empresa/)).toBeInTheDocument()
  })
})
