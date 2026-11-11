// O TanStack Query pausa o polling com a aba oculta
export const SUMMARY_POLL_MS = 15 * 1000
export const CHART_POLL_MS = 15 * 1000
export const ALERTS_COUNT_POLL_MS = 30 * 1000

// Com o stream de eventos aberto (src/app/useLiveEvents.ts), os dados chegam por aviso e o
// polling vira rede de segurança. Ele ainda recalcula o "sem sinal", que é ausência de dados.
const LIVE_POLL_MS = 60 * 1000

let liveConnected = false

export function setLiveConnected(value: boolean) {
  liveConnected = value
}

// Para refetchInterval: avaliado de novo a cada busca
export function pollInterval(ms: number) {
  return () => (liveConnected ? Math.max(ms, LIVE_POLL_MS) : ms)
}
