import axios from 'axios'

const TOKEN_KEY = 'coldchain.token'

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    // Sem armazenamento disponível, a sessão vale só até recarregar a página
  }
}

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
})

api.interceptors.request.use((config) => {
  const token = getToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

let onUnauthorized: (() => void) | null = null

export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler
}

api.interceptors.response.use(undefined, (error) => {
  // No login, o 401 significa só senha errada: quem trata é o formulário
  if (axios.isAxiosError(error) && error.response?.status === 401 && error.config?.url !== '/login') {
    onUnauthorized?.()
  }

  return Promise.reject(error)
})

export function getErrorStatus(error: unknown) {
  return axios.isAxiosError(error) ? error.response?.status : undefined
}

export function getErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { error?: unknown } | undefined

    if (typeof data?.error === 'string') return data.error
    if (!error.response) return 'Não foi possível conectar ao servidor. Verifique a sua conexão.'
  }

  return 'Algo deu errado. Tente novamente.'
}
