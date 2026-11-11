import { expect, test, type Page } from '@playwright/test'

// Usuário MASTER criado pelo seed da API
const MASTER_EMAIL = process.env.E2E_MASTER_EMAIL ?? 'adrian@teste.com'
const MASTER_PASSWORD = process.env.E2E_MASTER_PASSWORD ?? '123456'

// Prefixo reconhecido pela limpeza dos dados de teste
const run = Date.now()
const CNPJ = String(run).padStart(14, '9').slice(-14)
const ENTERPRISE = `e2e-${run} Frigorífico`
const ADMIN_EMAIL = `e2e-${run}-admin@teste.com`
const OPERATOR_EMAIL = `e2e-${run}-op@teste.com`
const PASSWORD = 'senha-e2e-123'
const UNIT = 'Câmara E2E'
// Os 6 últimos dígitos do relógio mantêm o MAC único a cada execução
const MAC = `E2:E2:E2:${String(run).slice(-6).match(/.{2}/g)!.join(':')}`

// Mostrada uma única vez no cadastro da placa e usada pelas leituras enviadas pela API
let deviceKey = ''

const nav = (page: Page) => page.getByRole('navigation', { name: 'Principal' })

async function login(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Senha').fill(password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('heading', { name: 'Visão geral' })).toBeVisible()
}

async function logout(page: Page) {
  await page.getByRole('button', { name: 'Sair' }).click()
  await expect(page.getByRole('heading', { name: 'Bem-vindo de volta' })).toBeVisible()
}

test.describe.serial('fluxo completo', () => {
  test('MASTER cria a empresa, o primeiro ADMIN e a placa', async ({ page }) => {
    await login(page, MASTER_EMAIL, MASTER_PASSWORD)

    await nav(page).getByRole('link', { name: 'Empresas' }).click()
    await page.getByRole('button', { name: 'Nova empresa' }).click()
    await page.getByLabel('Nome').fill(ENTERPRISE)
    await page.getByLabel('CNPJ').fill(CNPJ)
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByRole('heading', { name: ENTERPRISE })).toBeVisible()

    await page.getByRole('button', { name: 'Novo usuário' }).click()
    await page.getByLabel('Nome').fill('Admin E2E')
    await page.getByLabel('E-mail').fill(ADMIN_EMAIL)
    await expect(page.getByLabel('Perfil de acesso')).toHaveValue('ADMIN')
    await page.getByLabel('Senha inicial').fill(PASSWORD)
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByRole('cell', { name: ADMIN_EMAIL })).toBeVisible()

    // Cadastro pela tela própria do MASTER
    await nav(page).getByRole('link', { name: 'Cadastro de placas' }).click()
    await page.getByLabel('Empresa dona da placa').selectOption({ label: ENTERPRISE })
    await page.getByLabel('Endereço MAC').fill(MAC.toLowerCase())
    await page.getByRole('button', { name: 'Cadastrar placa' }).click()
    await expect(page.getByRole('cell', { name: MAC })).toBeVisible()
    await expect(page.getByLabel('Endereço MAC')).toHaveValue('')
    deviceKey = (await page.getByLabel('Chave da placa').textContent()) ?? ''
    expect(deviceKey).toMatch(/^ck_/)

    // A aba da empresa mostra a mesma placa
    await nav(page).getByRole('link', { name: 'Empresas' }).click()
    await page.getByRole('link', { name: ENTERPRISE }).click()
    await page.getByRole('tab', { name: 'Placas' }).click()
    await expect(page.getByRole('cell', { name: MAC })).toBeVisible()

    await logout(page)
  })

  test('ADMIN cria a unidade e um OPERATOR', async ({ page }) => {
    await login(page, ADMIN_EMAIL, PASSWORD)
    await expect(nav(page).getByRole('link', { name: 'Empresas' })).toHaveCount(0)
    await expect(nav(page).getByRole('link', { name: 'Cadastro de placas' })).toHaveCount(0)

    await nav(page).getByRole('link', { name: 'Unidades' }).click()
    await page.getByRole('button', { name: 'Nova unidade' }).click()
    await page.getByLabel('Nome').fill(UNIT)
    await page.getByLabel('Mínima (°C)').fill('5')
    await page.getByLabel('Máxima (°C)').fill('1')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('A máxima deve ser maior que a mínima.')).toBeVisible()
    await page.getByLabel('Mínima (°C)').fill('0')
    await page.getByLabel('Máxima (°C)').fill('5')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByRole('link', { name: UNIT })).toBeVisible()

    await nav(page).getByRole('link', { name: 'Usuários' }).click()
    await page.getByRole('button', { name: 'Novo usuário' }).click()
    await page.getByLabel('Nome').fill('Operador E2E')
    await page.getByLabel('E-mail').fill(OPERATOR_EMAIL)
    await expect(page.getByLabel('Perfil de acesso')).toHaveValue('OPERATOR')
    await page.getByLabel('Senha inicial').fill(PASSWORD)
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByRole('cell', { name: OPERATOR_EMAIL })).toBeVisible()

    await logout(page)
  })

  test('OPERATOR vincula pela quarentena, vê o alerta e o resolve', async ({ page, request }) => {
    // A placa sem vínculo envia dados: vão para a quarentena
    // Sem a chave da placa, ninguém envia leituras em nome dela
    const forged = await request.post('/api/telemetry/readings', { data: { macAddress: MAC, temperature: 30 } })
    expect(forged.status()).toBe(401)

    const headers = { 'X-Device-Key': deviceKey }
    const quarantined = await request.post('/api/telemetry/readings', { headers, data: { macAddress: MAC, temperature: 3.5 } })
    expect(quarantined.status()).toBe(202)

    await login(page, OPERATOR_EMAIL, PASSWORD)

    // O OPERATOR não administra
    await expect(nav(page).getByRole('link', { name: 'Usuários' })).toHaveCount(0)
    await page.goto('/usuarios')
    await expect(page.getByRole('heading', { name: 'Acesso negado' })).toBeVisible()
    await expect(nav(page).getByRole('link', { name: 'Cadastro de placas' })).toHaveCount(0)
    await page.goto('/placas/cadastro')
    await expect(page.getByRole('heading', { name: 'Acesso negado' })).toBeVisible()

    await page.goto('/')
    await expect(page.getByText('1 placa enviando dados sem vínculo')).toBeVisible()
    await page.getByRole('link', { name: 'Ver quarentena' }).click()
    await expect(page.getByRole('cell', { name: MAC })).toBeVisible()

    await page.getByRole('link', { name: 'Vincular', exact: true }).click()
    await page.getByLabel('Unidade onde a placa foi instalada').selectOption({ label: UNIT })
    await page.getByRole('button', { name: 'Confirmar vínculo' }).click()
    await expect(page.getByText('1 leitura da quarentena foi recuperada para esta unidade.')).toBeVisible()

    // Painel aberto com o stream de eventos conectado
    const stream = page.waitForResponse((response) => response.url().endsWith('/api/events'))
    await page.goto('/')
    await stream
    const card = page.getByRole('link', { name: new RegExp(UNIT) })
    await expect(card).toBeVisible()
    await expect(card.getByText('Fora dos limites')).toHaveCount(0)

    // Com o vínculo, um lote do store-and-forward fora da faixa vira um único alerta, e o reenvio é ignorado.
    // Os horários ficam depois do início do vínculo (a leitura recuperada) para não voltar à quarentena.
    const now = Date.now()
    const batch = [20, 21, 22].map((temperature, index) => ({ temperature, timestamp: new Date(now - (3 - index) * 1000).toISOString() }))
    const official = await request.post('/api/telemetry/readings', { headers, data: { macAddress: MAC, sourceType: 'HISTORICAL', readings: batch } })
    expect(official.status()).toBe(201)
    const resent = await request.post('/api/telemetry/readings', { headers, data: { macAddress: MAC, sourceType: 'HISTORICAL', readings: batch } })
    expect(resent.status()).toBe(200)
    expect(await resent.json()).toEqual({ stored: 0, quarantined: 0, duplicates: 3 })

    // Sem recarregar: o aviso do stream chega antes do polling (15 s)
    await expect(card.getByText('Fora dos limites')).toBeVisible({ timeout: 5000 })
    await expect(card.getByText('1 alerta pendente')).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('1 placa enviando dados sem vínculo')).toHaveCount(0)

    // Detalhe: gráfico, leitura recuperada na tabela e vínculo ativo
    await card.click()
    await expect(page.getByRole('heading', { name: UNIT })).toBeVisible()
    await expect(page.getByRole('img', { name: /Temperatura da unidade/ })).toBeVisible()
    await expect(page.locator('.recharts-line-dots circle').first()).toBeAttached()

    await page.getByRole('tab', { name: 'Leituras' }).click()
    await expect(page.getByText('Recuperada').first()).toBeVisible()
    await expect(page.getByText('fora da faixa').first()).toBeVisible()

    await page.getByRole('tab', { name: 'Placas e vínculos' }).click()
    await expect(page.getByText('Ativo')).toBeVisible()

    // OPERATOR não vê as ações de administrador
    await expect(page.getByRole('button', { name: 'Excluir' })).toHaveCount(0)

    await nav(page).getByRole('link', { name: /^Alertas/ }).click()
    await page.getByRole('button', { name: 'Resolver' }).click()
    await expect(page.getByText('Nenhum alerta pendente')).toBeVisible()
    await page.getByRole('tab', { name: 'Resolvidos' }).click()
    await expect(page.getByText(/Resolvido em/)).toBeVisible()
  })

  test('sessão expirada volta ao login e retorna à página pedida', async ({ page }) => {
    await login(page, OPERATOR_EMAIL, PASSWORD)
    await page.evaluate(() => localStorage.setItem('coldchain.token', 'invalido'))
    await page.goto('/alertas')
    await expect(page.getByRole('heading', { name: 'Bem-vindo de volta' })).toBeVisible()
    await page.getByLabel('E-mail').fill(OPERATOR_EMAIL)
    await page.getByLabel('Senha').fill(PASSWORD)
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page.getByRole('heading', { name: 'Alertas' })).toBeVisible()
  })

  test('no celular, a navegação abre pelo menu e não há rolagem horizontal da página', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await login(page, OPERATOR_EMAIL, PASSWORD)

    await page.getByRole('button', { name: 'Abrir menu' }).click()
    await nav(page).getByRole('link', { name: 'Unidades' }).click()
    await expect(page.getByRole('heading', { name: 'Unidades' })).toBeVisible()
    const unitPath = (await page.getByRole('link', { name: UNIT }).getAttribute('href'))!

    for (const path of ['/', '/unidades', unitPath, '/alertas', '/vincular', '/placas', '/placas/quarentena', '/perfil']) {
      await page.goto(path)
      // Não dá para esperar networkidle: o stream de eventos (GET /events) fica aberto de propósito
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      await expect(page.getByText('Carregando...')).toHaveCount(0)
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      expect(overflow, `rolagem horizontal em ${path}`).toBeLessThanOrEqual(0)
    }
  })

  test('senha do perfil pode ser trocada', async ({ page }) => {
    await login(page, OPERATOR_EMAIL, PASSWORD)
    await page.goto('/perfil')
    await page.getByLabel('Senha atual').fill('errada-123')
    await page.getByLabel('Nova senha', { exact: true }).fill('nova-senha-123')
    await page.getByLabel('Confirme a nova senha').fill('nova-senha-123')
    await page.getByRole('button', { name: 'Alterar senha' }).click()
    await expect(page.getByText('A senha atual está incorreta.')).toBeVisible()
  })
})
