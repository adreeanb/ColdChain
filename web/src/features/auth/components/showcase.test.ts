import { DEMO_RANGE, DEMO_READINGS, cellsPath, formatDisplayTemperature, sparklineMatrix, textToMatrix } from './showcase'

describe('textToMatrix', () => {
  it('monta as 7 linhas do display com um ponto apagado entre os caracteres', () => {
    const matrix = textToMatrix(formatDisplayTemperature(-18.2))

    expect(matrix).toHaveLength(7)
    // '-' (4) + '1', '8', '2', 'C' (5 cada) + ',' (2) + '°' (3) + 6 vãos
    expect(new Set(matrix.map((line) => line.length))).toEqual(new Set([35]))
    expect(matrix[3].startsWith('####.')).toBe(true)
  })

  it('recusa caracteres sem glifo', () => {
    expect(() => textToMatrix('-18.2')).toThrow('Sem glifo para "."')
  })
})

describe('formatDisplayTemperature', () => {
  it('mostra sempre uma casa decimal com vírgula', () => {
    expect(formatDisplayTemperature(-18)).toBe('-18,0°C')
    expect(formatDisplayTemperature(-13.44)).toBe('-13,4°C')
  })
})

describe('cellsPath', () => {
  it('desenha um quadrado por ponto do tipo pedido', () => {
    expect(cellsPath(['#.', '.#'], '#')).toBe('M0 0h1v1h-1zM1 1h1v1h-1z')
    expect(cellsPath(['#.'], '#', 0.25)).toBe('M0.25 0.25h0.5v0.5h-0.5z')
  })
})

describe('sparklineMatrix', () => {
  const scale = { top: 0, bottom: -4, rows: 5, limit: -2 }

  it('marca em alerta as leituras acima do limite e pontilha a linha do limite', () => {
    expect(sparklineMatrix([-4, -4, -1, -4], scale)).toEqual([
      '....',
      '..!.',
      ':.!#',
      '..!#',
      '##.#',
    ])
  })

  it('prende ao gráfico as leituras fora da escala', () => {
    expect(sparklineMatrix([5, -10], scale)).toEqual(['!.', '.#', ':#', '.#', '.#'])
  })
})

describe('DEMO_READINGS', () => {
  it('sai da faixa e volta, para o painel mostrar um alerta a cada ciclo', () => {
    const outOfRange = DEMO_READINGS.map((value) => value > DEMO_RANGE.max || value < DEMO_RANGE.min)

    expect(outOfRange.some(Boolean)).toBe(true)
    expect(outOfRange[0]).toBe(false)
    expect(outOfRange.at(-1)).toBe(false)
  })
})
