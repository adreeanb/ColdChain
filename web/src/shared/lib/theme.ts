import { useSyncExternalStore } from 'react'

export type Theme = 'light' | 'dark'

// Também lida pelo script do index.html, que aplica o tema antes da primeira pintura
export const THEME_KEY = 'coldchain.theme'

const root = () => document.documentElement

// A classe .dark no <html> é a fonte da verdade. Ela muda pelo botão (setTheme)
// ou pelo sistema, quando não há escolha salva (script do index.html).
function getTheme(): Theme {
  return root().classList.contains('dark') ? 'dark' : 'light'
}

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange)
  observer.observe(root(), { attributes: true, attributeFilter: ['class'] })
  return () => observer.disconnect()
}

export function setTheme(theme: Theme) {
  localStorage.setItem(THEME_KEY, theme)
  root().classList.toggle('dark', theme === 'dark')
}

export function useTheme() {
  return useSyncExternalStore(subscribe, getTheme, (): Theme => 'light')
}
