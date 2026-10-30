import { useEffect, useRef, useState } from 'react'
import { BrowserQRCodeReader, type IScannerControls } from '@zxing/browser'
import { CameraOff } from 'lucide-react'

function cameraErrorMessage(error: unknown) {
  if (!window.isSecureContext) return 'O navegador só libera a câmera em conexão segura (HTTPS). Digite o MAC abaixo.'

  const name = error instanceof Error ? error.name : ''
  if (name === 'NotAllowedError') return 'A permissão da câmera foi negada. Libere-a nas configurações do navegador ou digite o MAC abaixo.'
  if (name === 'NotFoundError') return 'Nenhuma câmera encontrada neste aparelho. Digite o MAC abaixo.'

  return 'Não foi possível abrir a câmera. Digite o MAC abaixo.'
}

export function QrScanner({ onScan }: { onScan: (text: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string | null>(() => (navigator.mediaDevices ? null : cameraErrorMessage(null)))

  // O callback muda a cada render: a câmera não pode reiniciar por causa disso
  const onScanRef = useRef(onScan)
  useEffect(() => {
    onScanRef.current = onScan
  }, [onScan])

  useEffect(() => {
    let cancelled = false
    let controls: IScannerControls | undefined

    // Fora de HTTPS o navegador nem expõe mediaDevices
    if (!navigator.mediaDevices) return

    new BrowserQRCodeReader()
      .decodeFromConstraints({ video: { facingMode: 'environment' } }, videoRef.current!, (result) => {
        if (result) onScanRef.current(result.getText())
      })
      .then((started) => {
        // A tela pode ter saído enquanto a permissão era pedida
        if (cancelled) started.stop()
        else controls = started
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(cameraErrorMessage(err))
      })

    return () => {
      cancelled = true
      controls?.stop()
    }
  }, [])

  if (error) {
    return (
      <div role="alert" className="flex items-start gap-2.5 rounded-lg border p-4 text-sm">
        <CameraOff aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        {error}
      </div>
    )
  }

  return (
    <div className="relative aspect-square w-full max-w-sm overflow-hidden rounded-lg bg-black">
      {/* muted e playsInline são exigidos pelo Safari do iOS para abrir o vídeo sem tela cheia */}
      <video ref={videoRef} muted playsInline aria-label="Imagem da câmera para ler o QR Code" className="size-full object-cover" />
      <div aria-hidden className="absolute inset-[15%] rounded-lg border-2 border-white/80" />
    </div>
  )
}
