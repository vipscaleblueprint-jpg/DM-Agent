'use client';

import React, { useState } from 'react';
import { toast } from 'sonner';
import { generatePvpsN8n, addProductBothDbs } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

// Name + description -> generate the PVPS (n8n) -> review and save to both databases
export function AddProductModal({ open, onOpenChange, client, onSaved }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client?: { id: string; name: string };
  onSaved: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!busy) onOpenChange(next); }}>
      <DialogContent className="sm:max-w-lg bg-card">
        <DialogHeader>
          <DialogTitle>Add Product</DialogTitle>
          <DialogDescription>Register a new product or service for a client.</DialogDescription>
        </DialogHeader>
        {client && (
          <AddProductForm
            client={client}
            onBusyChange={setBusy}
            onSaved={async () => {
              onOpenChange(false);
              await onSaved();
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

// Mounted each time the dialog opens, so the fields start empty
function AddProductForm({ client, onBusyChange, onSaved }: {
  client: { id: string; name: string };
  onBusyChange: (busy: boolean) => void;
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [about, setAbout] = useState('');
  const [pvps, setPvps] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const busy = isGenerating || isSaving;

  const generate = async () => {
    if (!name.trim()) {
      toast.error('Product name is required');
      return;
    }
    setIsGenerating(true);
    onBusyChange(true);
    try {
      const res = await generatePvpsN8n(client.id, client.name || null, name, about);
      if (res.success && res.statement) {
        setPvps(res.statement);
        toast.success('PVPS generated!');
      } else {
        toast.error(res.error || 'Failed to generate PVPS');
      }
    } catch (e: any) {
      toast.error(e.message || 'Failed');
    } finally {
      setIsGenerating(false);
      onBusyChange(false);
    }
  };

  const save = async () => {
    if (!pvps?.trim()) {
      toast.error('PVPS is required');
      return;
    }
    setIsSaving(true);
    onBusyChange(true);
    try {
      const res = await addProductBothDbs(client.id, name, pvps, about);
      if (res.success) {
        toast.success('Product added successfully!');
        onBusyChange(false);
        await onSaved();
        return;
      }
      toast.error(res.error || 'Failed to add product');
    } catch (e: any) {
      toast.error(e.message);
    }
    setIsSaving(false);
    onBusyChange(false);
  };

  return (
    <div className="space-y-4 py-4">
      <div className="space-y-2">
        <Label>Client <span className="text-red-500">*</span></Label>
        <div className="relative">
          <Input value={client.name || ''} disabled className="bg-background cursor-not-allowed text-foreground" />
          <span className="material-symbols-sharp absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-lg pointer-events-none">expand_more</span>
        </div>
      </div>
      <div className="space-y-2">
        <Label>Product Name <span className="text-red-500">*</span></Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Social Reel Accelerator"
          className="bg-background"
          disabled={busy}
        />
      </div>
      <div className="space-y-2">
        <Label>About the Product</Label>
        <Textarea
          value={about}
          onChange={(e) => setAbout(e.target.value)}
          rows={4}
          placeholder="Short description of the product, its offer, and target audience..."
          className="bg-background resize-none"
          disabled={busy}
        />
      </div>
      {pvps === null ? (
        <Button
          className="w-full h-12 flex items-center justify-center gap-2 bg-gradient-to-r from-[#9d4edd] to-[#ff006e] hover:from-[#7b2cbf] hover:to-[#ff0a54] text-white font-medium border-0 transition-all shadow-md"
          onClick={generate}
          disabled={isGenerating || !name.trim()}
        >
          {isGenerating ? 'Generating PVPS...' : (
            <>
              <span className="material-symbols-sharp text-[1.1rem]">inventory_2</span> Add Product
            </>
          )}
        </Button>
      ) : (
        <>
          <div className="space-y-2">
            <Label>PVPS</Label>
            <Textarea
              value={pvps}
              onChange={(e) => setPvps(e.target.value)}
              rows={4}
              className="bg-background resize-none"
              disabled={busy}
            />
          </div>
          <div className="flex gap-3 mt-4">
            <Button variant="outline" className="flex-1" onClick={generate} disabled={busy}>
              Retry
            </Button>
            <Button className="flex-1" onClick={save} disabled={busy || !pvps.trim()}>
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
