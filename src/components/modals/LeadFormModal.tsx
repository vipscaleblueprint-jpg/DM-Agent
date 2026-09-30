'use client';

import React, { useState } from 'react';
import { TimezoneSelect } from '@/components/TimezoneSelect';
import { useConfirm } from '@/components/modals/ConfirmModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

export type LeadFormValues = { name: string; fbLink: string; timezone: string };

// Add Lead and Edit Lead: the same three fields, different title and button
export function LeadFormModal({ open, onOpenChange, mode, initial, onSubmit }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'add' | 'edit';
  initial?: LeadFormValues;
  onSubmit: (values: LeadFormValues) => Promise<void>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="material-symbols-sharp">{mode === 'add' ? 'person_add' : 'edit'}</span>
            {mode === 'add' ? 'Add New Lead' : 'Edit Lead'}
          </DialogTitle>
        </DialogHeader>
        <LeadForm mode={mode} initial={initial} onSubmit={onSubmit} onCancel={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

// Mounted each time the dialog opens, so the fields start from `initial`
function LeadForm({ mode, initial, onSubmit, onCancel }: {
  mode: 'add' | 'edit';
  initial?: LeadFormValues;
  onSubmit: (values: LeadFormValues) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [fbLink, setFbLink] = useState(initial?.fbLink ?? '');
  const [timezone, setTimezone] = useState(initial?.timezone ?? '');
  const [busy, setBusy] = useState(false);
  const { confirm, confirmDialog } = useConfirm();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (mode === 'edit' && !(await confirm({
      title: 'Save Lead Changes',
      icon: 'edit',
      message: <>Save the changes to <strong>{name.trim()}</strong>?</>,
      detail: timezone !== (initial?.timezone ?? '') ? 'The timezone changed, so follow-up times will be recalculated.' : undefined,
      confirmLabel: 'Save changes',
    }))) return;
    setBusy(true);
    try {
      await onSubmit({ name, fbLink, timezone });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4 py-4">
      <div className="space-y-2">
        <Label htmlFor="leadName">Lead Name</Label>
        <Input
          id="leadName"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Dr. Jane Smith"
          required
          autoFocus
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="leadFb">Facebook Profile URL (Optional)</Label>
        <Input
          id="leadFb"
          type="url"
          value={fbLink}
          onChange={(e) => setFbLink(e.target.value)}
          placeholder="https://facebook.com/..."
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="leadTimezone">Lead Timezone (Optional)</Label>
        <TimezoneSelect id="leadTimezone" value={timezone} onChange={setTimezone} />
        <p className="text-xs text-muted-foreground">Follow-up reminders are scheduled in the lead&apos;s local time.</p>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy || !name.trim()}>
          {mode === 'add' ? (busy ? 'Adding...' : 'Add Lead') : (busy ? 'Saving...' : 'Save Changes')}
        </Button>
      </DialogFooter>
      {confirmDialog}
    </form>
  );
}
