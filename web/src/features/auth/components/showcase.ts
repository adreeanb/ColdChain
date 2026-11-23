// Lógica do painel decorativo do login: arte em pixels e um ciclo de leituras fictícias.
// Uma matriz é uma lista de linhas do mesmo tamanho, com um caractere por ponto:
// '#' aceso, '!' aceso em alerta, ':' meio aceso (linha de limite) e '.' apagado.

// Fonte de 7 linhas no estilo dos displays de LED dos equipamentos de refrigeração
const GLYPHS: Record<string, string[]> = {
  '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  '3': ['#####', '...#.', '..#..', '...#.', '....#', '#...#', '.###.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
  '-': ['....', '....', '....', '####', '....', '....', '....'],
  ',': ['..', '..', '..', '..', '##', '.#', '#.'],
  '°': ['.#.', '#.#', '.#.', '...', '...', '...', '...'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
}

export const SPRITES = {
  snowflake: ['....#....', '.#..#..#.', '..#.#.#..', '...###...', '#########', '...###...', '..#.#.#..', '.#..#..#.', '....#....'],
  bell: ['....#....', '...###...', '..#####..', '..#####..', '..#####..', '.#######.', '#########', '.........', '...###...'],
  qrCode: ['###.#.###', '#.#..##.#', '###.#.###', '...##.#..', '#.#.#.##.', '.##...#.#', '###.##.#.', '#.#.#..##', '###..#.#.'],
}

export function textToMatrix(text: string) {
  const glyphs = [...text].map((char) => {
    const glyph = GLYPHS[char]
    if (!glyph) throw new Error(`Sem glifo para "${char}"`)
    return glyph
  })
  return Array.from({ length: 7 }, (_, row) => glyphs.map((glyph) => glyph[row]).join('.'))
}

// Como no display de uma câmara: sempre uma casa decimal, com vírgula
export function formatDisplayTemperature(value: number) {
  return `${value.toFixed(1).replace('.', ',')}°C`
}

// Junta os pontos de um tipo num único path; `inset` deixa o vão entre os pontos
export function cellsPath(matrix: string[], char: string, inset = 0) {
  const size = 1 - inset * 2
  let d = ''
  matrix.forEach((line, y) => {
    for (let x = 0; x < line.length; x++) {
      if (line[x] === char) d += `M${x + inset} ${y + inset}h${size}v${size}h${-size}z`
    }
  })
  return d
}

export interface SparklineScale {
  top: number
  bottom: number
  rows: number
  limit: number
}

// Uma coluna por leitura, ligando cada ponto ao anterior, com o limite máximo pontilhado
export function sparklineMatrix(values: number[], { top, bottom, rows, limit }: SparklineScale) {
  const toRow = (value: number) => {
    const row = Math.round(((top - value) / (top - bottom)) * (rows - 1))
    return Math.min(rows - 1, Math.max(0, row))
  }
  const limitRow = toRow(limit)
  const grid = Array.from({ length: rows }, (_, row) => values.map((_, col): string => (row === limitRow && col % 2 === 0 ? ':' : '.')))

  values.forEach((value, col) => {
    const row = toRow(value)
    const prev = col > 0 ? toRow(values[col - 1]) : row
    const [from, to] = row < prev ? [row, prev - 1] : row > prev ? [prev + 1, row] : [row, row]
    for (let r = from; r <= to; r++) grid[r][col] = value > limit ? '!' : '#'
  })

  return grid.map((line) => line.join(''))
}

export const DEMO_RANGE = { min: -25, max: -15 }

// Um ciclo de leituras de uma câmara a -18 °C: oscila um pouco, esquenta além do limite
// (uma porta aberta, por exemplo) e volta ao normal. Gerado sem aleatoriedade, para repetir igual.
export const DEMO_READINGS = Array.from({ length: 48 }, (_, i) => {
  const wobble = 0.3 * Math.sin(i * 1.7) + 0.2 * Math.sin(i * 0.6)
  const excursion = 5 * Math.exp(-(((i - 26) / 3.6) ** 2))
  return Math.round((-18.2 + wobble + excursion) * 10) / 10
})
