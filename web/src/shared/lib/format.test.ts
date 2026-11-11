import { extractMacAddress, formatCountdown, formatRelative, formatTemperature } from './format'

describe('extractMacAddress', () => {
  it.each([
    ['AA:BB:CC:DD:EE:FF', 'AA:BB:CC:DD:EE:FF'],
    ['aa-bb-cc-dd-ee-ff', 'AA:BB:CC:DD:EE:FF'],
    ['aabb.ccdd.eeff', 'AA:BB:CC:DD:EE:FF'],
    ['aabbccddeeff', 'AA:BB:CC:DD:EE:FF'],
    ['https://exemplo.com/placa/AA:BB:CC:DD:EE:01', 'AA:BB:CC:DD:EE:01'],
    ['{"mac":"AA:BB:CC:DD:EE:02"}', 'AA:BB:CC:DD:EE:02'],
  ])('encontra o MAC em %s', (text, expected) => {
    expect(extractMacAddress(text)).toBe(expected)
  })

  it.each(['', 'nao é um mac', 'AA:BB:CC', 'AABBCCDDEEFF00', 'GG:BB:CC:DD:EE:FF'])('recusa %s', (text) => {
    expect(extractMacAddress(text)).toBeNull()
  })
})

describe('formatos de exibição', () => {
  const now = new Date('2026-10-30T12:00:00Z')

  it('usa vírgula decimal e o símbolo de grau', () => {
    expect(formatTemperature(4.25)).toMatch(/^4,[23] °C$/)
    expect(formatTemperature(-18)).toBe('-18 °C')
  })

  it('descreve o tempo decorrido', () => {
    expect(formatRelative('2026-10-30T11:59:40Z', now)).toBe('agora há pouco')
    expect(formatRelative('2026-10-30T11:45:00Z', now)).toBe('há 15 min')
    expect(formatRelative('2026-10-30T09:00:00Z', now)).toBe('há 3 h')
    expect(formatRelative('2026-10-29T12:00:00Z', now)).toBe('há 1 dia')
  })

  it('descreve o tempo até expirar', () => {
    expect(formatCountdown('2026-10-30T12:30:00Z', now)).toBe('30 min')
    expect(formatCountdown('2026-10-30T13:30:00Z', now)).toBe('1 h 30 min')
    expect(formatCountdown('2026-10-30T14:00:00Z', now)).toBe('2 h')
    expect(formatCountdown('2026-10-30T11:00:00Z', now)).toBe('expirando')
  })
})
