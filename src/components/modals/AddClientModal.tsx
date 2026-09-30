'use client';

import React, { useState } from 'react';
import { toast } from 'sonner';
import { addClient } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';

export function AddClientModal({ open, onOpenChange, onCreated }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (client: any) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Client</DialogTitle>
          <DialogDescription>
            Create a new client context. Leads will be strictly tied to this client.
          </DialogDescription>
        </DialogHeader>
        <AddClientForm onCreated={onCreated} onCancel={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function AddClientForm({ onCreated, onCancel }: { onCreated: (client: any) => void; onCancel: () => void }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    const res = await addClient(name);
    setBusy(false);
    if (res.success && res.client) {
      toast.success('Client added successfully');
      onCreated(res.client);
    } else {
      toast.error(res.error || 'Failed to add client');
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4 py-4">
      <div className="space-y-2">
        <Label htmlFor="clientName">Client Name *</Label>
        <Input
          id="clientName"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Alpha Coach"
          required
          className="bg-background"
          autoFocus
        />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? 'Creating...' : 'Create Client'}
        </Button>
      </DialogFooter>
    </form>
  );
}
