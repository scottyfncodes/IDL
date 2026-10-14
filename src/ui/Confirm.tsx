import { Button } from './Button';
import { Sheet } from './Sheet';

export interface ConfirmProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function Confirm({ open, title, message, confirmLabel, cancelLabel = 'Keep playing', destructive, onConfirm, onCancel }: ConfirmProps) {
  return (
    <Sheet
      open={open}
      onClose={onCancel}
      title={title}
      actions={
        <>
          <Button variant="quiet" onClick={onCancel}>{cancelLabel}</Button>
          <Button variant={destructive ? 'danger' : 'primary'} onClick={onConfirm}>{confirmLabel}</Button>
        </>
      }
    >
      <p className="muted">{message}</p>
    </Sheet>
  );
}
