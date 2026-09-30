'use client';

import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

// "Are you sure?" dialog. `destructive` gives the red style used for deletes.
// onConfirm does the work (and any toasts); the dialog only tracks the busy state.
export function ConfirmModal({ open, onOpenChange, title, icon, confirmLabel, busyLabel, destructive = false, onConfirm, children }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  icon?: string;
  confirmLabel: string;
  busyLabel: string;
  destructive?: boolean;
  onConfirm: () => Promise<void>;
  children: React.ReactNode;
}) {
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!busy) onOpenChange(next); }}>
      <DialogContent className={`sm:max-w-md ${destructive ? 'border-destructive/20' : ''}`}>
        <DialogHeader>
          <DialogTitle className={`flex items-center gap-2 ${destructive ? 'text-destructive' : ''}`}>
            <span className={`material-symbols-sharp ${destructive ? '' : 'text-primary'}`}>{icon ?? (destructive ? 'warning' : 'help')}</span>
            {title}
          </DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-2">{children}</div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" variant={destructive ? 'destructive' : 'default'} onClick={confirm} disabled={busy}>
            {busy ? busyLabel : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export type ConfirmOptions = {
  title: string;
  message: React.ReactNode;
  detail?: React.ReactNode;
  confirmLabel: string;
  icon?: string;
  destructive?: boolean;
};

// Ask-before-doing in one line: `if (!(await confirm({ ... }))) return;`
// Render `confirmDialog` once in the component that calls `confirm`.
export function useConfirm() {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolveRef = useRef<((ok: boolean) => void) | null>(null);

  const confirm = (opts: ConfirmOptions) => new Promise<boolean>(resolve => {
    resolveRef.current = resolve;
    setOptions(opts);
    setOpen(true);
  });

  const finish = (ok: boolean) => {
    resolveRef.current?.(ok);
    resolveRef.current = null;
    setOpen(false);
  };

  const confirmDialog = (
    <ConfirmModal
      open={open}
      onOpenChange={(next) => { if (!next) finish(false); }}
      title={options?.title ?? ''}
      icon={options?.icon}
      destructive={options?.destructive}
      confirmLabel={options?.confirmLabel ?? 'Confirm'}
      busyLabel={options?.confirmLabel ?? 'Confirm'}
      onConfirm={async () => finish(true)}
    >
      <p className="text-sm text-foreground">{options?.message}</p>
      {options?.detail && <p className="text-sm text-muted-foreground">{options.detail}</p>}
    </ConfirmModal>
  );

  return { confirm, confirmDialog };
}
