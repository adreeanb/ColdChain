import { render, screen } from '@testing-library/react'
import type { ColdUnitStatus } from '@/shared/domain'
import { UnitStatusBadge } from './unit-status-badge'

describe('UnitStatusBadge', () => {
  it.each<[ColdUnitStatus, string]>([
    ['NORMAL', 'Normal'],
    ['OUT_OF_RANGE', 'Fora dos limites'],
    ['NO_SIGNAL', 'Sem sinal'],
    ['NO_DEVICE', 'Sem placa'],
  ])('%s sempre traz texto, não só cor', (status, label) => {
    render(<UnitStatusBadge status={status} />)
    expect(screen.getByText(label)).toBeInTheDocument()
  })
})
