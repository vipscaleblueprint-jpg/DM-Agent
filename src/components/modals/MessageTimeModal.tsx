'use client';

import React, { useState } from 'react';
import { TimeFields } from '@/components/DateTimePicker';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';

// Asks when a simulated lead message was sent (defaults to now), so the timeline stays accurate
export function MessageTimeModal({ open, onOpenChange, onConfirm }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (sentAt: Date) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Message Sent At</DialogTitle>
          <DialogDescription>
            Specify the exact time this message was sent, so the agent&apos;s memory reflects the accurate timeline.
          </DialogDescription>
        </DialogHeader>
        <MessageTimeForm onConfirm={onConfirm} onCancel={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

// Mounted each time the dialog opens, so it starts at the current time
function MessageTimeForm({ onConfirm, onCancel }: { onConfirm: (sentAt: Date) => void; onCancel: () => void }) {
  const [date, setDate] = useState(() => new Date());
  const [hour12, setHour12] = useState(() => new Date().getHours() % 12 || 12);
  const [minute, setMinute] = useState(() => new Date().getMinutes());
  const [pm, setPm] = useState(() => new Date().getHours() >= 12);

  const confirm = () => {
    const h24 = (hour12 % 12) + (pm ? 12 : 0);
    onConfirm(new Date(date.getFullYear(), date.getMonth(), date.getDate(), h24, minute));
  };

  return (
    <>
      <div className="grid gap-4 py-4">
        <div className="flex flex-col gap-3">
          <label className="text-sm font-medium">Date (Local)</label>
          <div className="border rounded-md mx-auto w-fit bg-background p-1">
            <Calendar
              mode="single"
              selected={date}
              onSelect={(d) => d && setDate(d)}
              initialFocus
            />
          </div>

          <label className="text-sm font-medium mt-2">Time (Local)</label>
          <TimeFields
            size="default"
            hour12={hour12}
            minute={minute}
            pm={pm}
            onChange={(h, m, isPm) => {
              setHour12(h);
              setMinute(m);
              setPm(isPm);
            }}
          />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={confirm}>Confirm Send</Button>
      </DialogFooter>
    </>
  );
}
