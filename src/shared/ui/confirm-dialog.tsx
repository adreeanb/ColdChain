import { useState, type ReactNode } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from './alert-dialog'
import { Input } from './input'
import { Label } from './label'

export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  confirmationText,
  onConfirm,
}: {
  trigger: ReactNode
  title: string
  description: ReactNode
  confirmLabel: string
  /** Quando informado, a pessoa precisa digitar este texto para confirmar. */
  confirmationText?: string
  onConfirm: () => void
}) {
  const [typed, setTyped] = useState('')

  return (
    <AlertDialog onOpenChange={() => setTyped('')}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div>{description}</div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        {confirmationText && (
          <div className="grid gap-1.5">
            <Label htmlFor="confirm-text">Digite "{confirmationText}" para confirmar</Label>
            <Input id="confirm-text" value={typed} onChange={(event) => setTyped(event.target.value)} autoComplete="off" />
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={confirmationText !== undefined && typed !== confirmationText}
            className="bg-destructive text-white hover:bg-destructive/90"
            onClick={onConfirm}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
