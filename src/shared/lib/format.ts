const dateTimeFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
const fullDateTimeFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'medium' })
const timeFormat = new Intl.DateTimeFormat('pt-BR', { timeStyle: 'short' })
const dayFormat = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' })
const numberFormat = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 })

export function formatTemperature(value: number) {
  return `${numberFormat.format(value)} °C`
}

export function formatDateTime(value: string | Date | number) {
  return dateTimeFormat.format(new Date(value))
}

export function formatFullDateTime(value: string | Date | number) {
  return fullDateTimeFormat.format(new Date(value))
}

export function formatTime(value: string | Date | number) {
  return timeFormat.format(new Date(value))
}

export function formatDay(value: string | Date | number) {
  return dayFormat.format(new Date(value))
}

export function formatRelative(value: string | Date, now = new Date()) {
  const minutes = Math.floor((now.getTime() - new Date(value).getTime()) / 60000)

  if (minutes < 1) return 'agora há pouco'
  if (minutes < 60) return `há ${minutes} min`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `há ${hours} h`

  const days = Math.floor(hours / 24)
  return days === 1 ? 'há 1 dia' : `há ${days} dias`
}

export function formatCountdown(value: string | Date, now = new Date()) {
  const minutes = Math.ceil((new Date(value).getTime() - now.getTime()) / 60000)

  if (minutes <= 0) return 'expirando'
  if (minutes < 60) return `${minutes} min`

  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours} h ${rest} min` : `${hours} h`
}

// O QR Code pode trazer só o MAC ou um texto que o contenha. A validação final é da API.
export function extractMacAddress(text: string) {
  const match = text.match(/(?<![0-9A-Fa-f])(?:[0-9A-Fa-f]{2}[:\-.]?){5}[0-9A-Fa-f]{2}(?![0-9A-Fa-f])/)

  if (!match) return null

  const hex = match[0].replace(/[:\-.]/g, '').toUpperCase()
  return hex.match(/.{2}/g)!.join(':')
}
