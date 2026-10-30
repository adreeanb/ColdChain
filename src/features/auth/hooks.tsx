import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getErrorStatus, getToken, setToken, setUnauthorizedHandler } from '@/shared/api/client'
import * as authApi from './api'
import type { CurrentUser } from './types'

interface AuthContextValue {
  user: CurrentUser | null
  isLoading: boolean
  /** A sessão existe, mas o perfil não pôde ser carregado (API fora do ar, por exemplo). */
  loadError: unknown
  retry: () => void
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export const CURRENT_USER_KEY = ['me'] as const

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [hasToken, setHasToken] = useState(() => Boolean(getToken()))

  const signOut = useCallback(() => {
    setToken(null)
    setHasToken(false)
    queryClient.clear()
  }, [queryClient])

  useEffect(() => {
    setUnauthorizedHandler(signOut)
    return () => setUnauthorizedHandler(null)
  }, [signOut])

  const me = useQuery({
    queryKey: CURRENT_USER_KEY,
    queryFn: authApi.getCurrentUser,
    enabled: hasToken,
    staleTime: 5 * 60 * 1000,
  })

  // O token vale 1 dia mesmo depois de o usuário ser excluído: o 404 do /me encerra a sessão
  useEffect(() => {
    if (me.isError && getErrorStatus(me.error) === 404) signOut()
  }, [me.isError, me.error, signOut])

  const signIn = useCallback(
    async (email: string, password: string) => {
      const { token } = await authApi.login(email, password)
      setToken(token)
      setHasToken(true)
      await queryClient.fetchQuery({ queryKey: CURRENT_USER_KEY, queryFn: authApi.getCurrentUser })
    },
    [queryClient],
  )

  const value = useMemo<AuthContextValue>(
    () => ({
      user: hasToken ? (me.data ?? null) : null,
      isLoading: hasToken && me.isPending,
      loadError: hasToken && !me.data ? me.error : null,
      retry: () => void me.refetch(),
      signIn,
      signOut,
    }),
    [hasToken, me, signIn, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth precisa estar dentro de AuthProvider')
  return context
}
