import { Toaster as Sonner, type ToasterProps } from 'sonner'
import { useTheme } from '@/shared/lib/theme'

export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme={useTheme()}
      richColors
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
        } as React.CSSProperties
      }
      {...props}
    />
  )
}
