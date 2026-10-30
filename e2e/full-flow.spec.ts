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
  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible()
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

    await page.getByRole('tab', { name: 'Placas' }).click()
    await page.getByRole('button', { name: 'Cadastrar placa' }).click()
    await page.getByLabel('Endereço MAC').fill(MAC.toLowerCase())
    await page.getByRole('button', { name: 'Cadastrar', exact: true }).click()
    await expect(page.getByRole('cell', { name: MAC })).toBeVisible()

    await logout(page)
  })

  test('ADMIN cria a unidade e um OPERATOR', async ({ page }) => {
    await login(page, ADMIN_EMAIL, PASSWORD)
    await expect(nav(page).getByRole('link', { name: 'Empresas' })).toHaveCount(0)

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
    const quarantined = await request.post('/api/telemetry/readings', { data: { macAddress: MAC, temperature: 3.5 } })
    expect(quarantined.status()).toBe(202)

    await login(page, OPERATOR_EMAIL, PASSWORD)

    // O OPERATOR não administra
    await expect(nav(page).getByRole('link', { name: 'Usuários' })).toHaveCount(0)
    await page.goto('/usuarios')
    await expect(page.getByRole('heading', { name: 'Acesso negado' })).toBeVisible()

    await page.goto('/')
    await expect(page.getByText('1 placa enviando dados sem vínculo')).toBeVisible()
    await page.getByRole('link', { name: 'Ver quarentena' }).click()
    await expect(page.getByRole('cell', { name: MAC })).toBeVisible()

    await page.getByRole('link', { name: 'Vincular', exact: true }).click()
    await page.getByLabel('Unidade onde a placa foi instalada').selectOption({ label: UNIT })
    await page.getByRole('button', { name: 'Confirmar vínculo' }).click()
    await expect(page.getByText('1 leitura da quarentena foi recuperada para esta unidade.')).toBeVisible()

    // Com o vínculo, a leitura vira oficial e, fora da faixa, gera alerta
    const official = await request.post('/api/telemetry/readings', { data: { macAddress: MAC, temperature: 20 } })
    expect(official.status()).toBe(201)

    await page.goto('/')
    const card = page.getByRole('link', { name: new RegExp(UNIT) })
    await expect(card.getByText('Fora dos limites')).toBeVisible()
    await expect(card.getByText('1 alerta pendente')).toBeVisible()
    await expect(page.getByText('1 placa enviando dados sem vínculo')).toHaveCount(0)

    // Detalhe: gráfico, leitura recuperada na tabela e vínculo ativo
    await card.click()
    await expect(page.getByRole('heading', { name: UNIT })).toBeVisible()
    await expect(page.getByRole('img', { name: /Temperatura da unidade/ })).toBeVisible()
    await expect(page.locator('.recharts-line-dots circle').first()).toBeAttached()

    await page.getByRole('tab', { name: 'Leituras' }).click()
    await expect(page.getByText('Recuperada')).toBeVisible()
    await expect(page.getByText('fora da faixa')).toBeVisible()

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
    await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible()
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
      await page.waitForLoadState('networkidle')
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
