import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { THEME_KEY } from '@/shared/lib/theme'
import { ThemeToggle } from './theme-toggle'

afterEach(() => document.documentElement.classList.remove('dark'))

describe('ThemeToggle', () => {
  it('alterna o tema no <html> e guarda a escolha', async () => {
    const user = userEvent.setup()
    render(<ThemeToggle />)
    const button = screen.getByRole('button', { name: 'Tema escuro' })

    expect(button.getAttribute('aria-pressed')).toBe('false')

    await user.click(button)
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(localStorage.getItem(THEME_KEY)).toBe('dark')
    expect(button.getAttribute('aria-pressed')).toBe('true')

    await user.click(button)
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(localStorage.getItem(THEME_KEY)).toBe('light')
  })

  it('acompanha o tema aplicado de fora, como a mudança do sistema', async () => {
    render(<ThemeToggle />)
    document.documentElement.classList.add('dark')

    await screen.findByRole('button', { name: 'Tema escuro', pressed: true })
  })
})
