import { useEffect } from 'react'
import { useQueryClient, type QueryKey } from '@tanstack/react-query'
import { SUMMARY_KEY } from '@/features/dashboard'
import { api, getToken } from '@/shared/api/client'
import { setLiveConnected } from '@/shared/polling'

interface LiveEvent {
  type: 'telemetry' | 'alerts' | 'devices'
  coldUnitIds: string[]
}

// Um forward do store-and-forward chega em vários lotes seguidos: junta os avisos antes de buscar
const FLUSH_MS = 1000
const MAX_RETRY_MS = 30 * 1000

function keysFor({ type, coldUnitIds }: LiveEvent): QueryKey[] {
  if (type === 'telemetry') {
    return [SUMMARY_KEY, ['alerts'], ['devices'], ...coldUnitIds.map((id) => ['cold-units', id])]
  }

  if (type === 'alerts') return [SUMMARY_KEY, ['alerts']]

  return [SUMMARY_KEY, ['alerts'], ['devices'], ['cold-units']]
}

/**
 * Abre o stream GET /events (Server-Sent Events) e invalida as consultas afetadas a cada aviso.
 * Usa fetch em vez de EventSource porque o EventSource não envia o header Authorization.
 * Enquanto o stream está aberto o polling fica lento (src/shared/polling.ts); se ele cair,
 * o polling volta ao ritmo normal e a conexão é refeita com espera crescente.
 */
export function useLiveEvents() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const controller = new AbortController()
    const pending = new Map<string, QueryKey>()
    let flushTimer: ReturnType<typeof setTimeout> | undefined

    const schedule = (keys: QueryKey[]) => {
      keys.forEach((key) => pending.set(JSON.stringify(key), key))
      flushTimer ??= setTimeout(() => {
        flushTimer = undefined
        pending.forEach((key) => void queryClient.invalidateQueries({ queryKey: key }))
        pending.clear()
      }, FLUSH_MS)
    }

    const handleBlock = (block: string) => {
      const lines = block.split('\n')

      if (lines.includes('event: ready')) {
        setLiveConnected(true)
        // Ao (re)conectar, o que mudou enquanto o stream estava fora também precisa aparecer
        schedule([SUMMARY_KEY, ['alerts'], ['devices'], ['cold-units']])
        return
      }

      const data = lines.find((line) => line.startsWith('data: '))
      if (!data) return

      try {
        schedule(keysFor(JSON.parse(data.slice(6)) as LiveEvent))
      } catch {
        // Aviso malformado: o polling cobre
      }
    }

    const listen = async () => {
      const token = getToken()
      const response = await fetch(`${api.defaults.baseURL ?? ''}/events`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' },
        signal: controller.signal,
      })

      // Sessão expirada: as outras requisições já levam ao login
      if (response.status === 401) return false
      if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`)

      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader()
      let buffer = ''

      for (;;) {
        const { value, done } = await reader.read()
        if (done) return true

        buffer += value
        let end = buffer.indexOf('\n\n')
        while (end >= 0) {
          handleBlock(buffer.slice(0, end))
          buffer = buffer.slice(end + 2)
          end = buffer.indexOf('\n\n')
        }
      }
    }

    const run = async () => {
      let retryMs = 1000

      while (!controller.signal.aborted) {
        try {
          const keepTrying = await listen()
          if (!keepTrying) break
          retryMs = 1000
        } catch {
          if (controller.signal.aborted) break
        }

        setLiveConnected(false)
        await new Promise((resolve) => setTimeout(resolve, retryMs))
        retryMs = Math.min(retryMs * 2, MAX_RETRY_MS)
      }

      setLiveConnected(false)
    }

    void run()

    return () => {
      controller.abort()
      clearTimeout(flushTimer)
      setLiveConnected(false)
    }
  }, [queryClient])
}
