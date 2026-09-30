'use client';

import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { saveClientContext, uploadFileToR2, getClientStages, saveClientStages, saveGhlSettings } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { useConfirm, type ConfirmOptions } from '@/components/modals/ConfirmModal';

type Tab = 'knowledge' | 'funnel' | 'ghl';

const TABS: { key: Tab; icon: string; label: string }[] = [
  { key: 'knowledge', icon: 'menu_book', label: 'Global Knowledge Base' },
  { key: 'funnel', icon: 'account_tree', label: 'Funnel Stages & Prompts' },
  { key: 'ghl', icon: 'forum', label: 'GoHighLevel' },
];

const URL_REGEX = /(https?:\/\/[^\s]+)/g;

// Builds each stage's checklist from the "STAGE ASSESSMENT:" block in its prompt (no AI call);
// falls back to the stage's existing checklist when the prompt has none
function withChecklistConfig(stage: any) {
  let config: any[] = [];
  const match = stage.systemPrompt.match(/STAGE ASSESSMENT:([\s\S]+?)(?:IMPORTANT:|FINAL CHECK BEFORE RESPONDING|$)/i);
  if (match) {
    const lines = match[1].trim().split('\n').map((l: string) => l.trim()).filter(Boolean);
    const ignoreKeys = ['Latest Message Sender', 'Current Stage', 'Lead Status', 'Stage Exit Criteria Met', 'Summary'];
    for (const line of lines) {
      const parts = line.split(':');
      if (parts.length < 2) continue;
      const label = parts[0].trim();
      if (ignoreKeys.includes(label)) continue;
      config.push({
        id: label.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
        type: line.includes('[Captured / Missing]') ? 'boolean' : 'string',
        label,
      });
    }
  }

  if (config.length === 0) {
    if (typeof stage.checklistConfig === 'string') {
      try {
        config = JSON.parse(stage.checklistConfig || '[]');
      } catch {
        console.error('Invalid JSON in stage', stage.stageOrder);
      }
    } else {
      config = stage.checklistConfig || [];
    }
  }

  return { ...stage, checklistConfig: config };
}

export function ClientSettingsModal({ open, onOpenChange, client, productId, onSaved, onStagesSaved }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: any;
  productId: string | null;
  onSaved: () => Promise<void>;
  onStagesSaved: (stages: any[]) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-4xl max-h-[90vh] overflow-y-auto overflow-x-hidden p-4 sm:p-6">
        <DialogHeader className="border-b border-border pb-4 mb-4">
          <DialogTitle className="flex justify-between items-center text-xl">
            <div className="flex items-center gap-2">
              <span className="material-symbols-sharp text-primary">settings_applications</span>
              Client Configuration
            </div>
          </DialogTitle>
          <DialogDescription className="text-sm pt-2">
            Configure the AI&apos;s global knowledge base and its stage-by-stage sales funnel for this client.
          </DialogDescription>
        </DialogHeader>
        {client && (
          <ClientSettings
            client={client}
            productId={productId}
            onClose={() => onOpenChange(false)}
            onSaved={onSaved}
            onStagesSaved={onStagesSaved}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

// Mounted each time the dialog opens, so it starts from the client's saved settings
function ClientSettings({ client, productId, onClose, onSaved, onStagesSaved }: {
  client: any;
  productId: string | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onStagesSaved: (stages: any[]) => void;
}) {
  const [tab, setTab] = useState<Tab>('knowledge');
  const [isSaving, setIsSaving] = useState(false);
  const { confirm, confirmDialog } = useConfirm();

  // Knowledge base: the saved context is split into free text (kept as is) and file links (editable here)
  const contextText = (client.context || '').replace(URL_REGEX, '').replace(/Asset:/g, '').trim();
  const [contextUrls, setContextUrls] = useState<string[]>(() => client.context?.match(URL_REGEX) || []);

  // Funnel
  const [stages, setStages] = useState<any[]>([]);
  const [activeStageIndex, setActiveStageIndex] = useState(0);
  useEffect(() => {
    getClientStages(client.id, productId).then(setStages).catch(err => console.error(err));
  }, [client.id, productId]);

  // GoHighLevel (the token is never sent to the browser; blank = keep the saved one)
  const [ghlLocationId, setGhlLocationId] = useState(client.ghlLocationId || '');
  const [ghlToken, setGhlToken] = useState('');
  const [ghlAutoReply, setGhlAutoReply] = useState(!!client.ghlAutoReply);

  const uploadContextFile = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File is larger than 10 MB.');
      return;
    }
    setIsSaving(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const { fileUrl, error } = await uploadFileToR2(formData);
      if (error) {
        toast.error(`Upload failed: ${error}`);
      } else if (fileUrl) {
        const publicUrl = process.env.NEXT_PUBLIC_R2_URL || 'https://aidm.xfnite.cloud';
        setContextUrls(prev => [...prev, `${publicUrl}/${fileUrl}`]);
        toast.success('File uploaded. Click Save Settings to apply it.');
      }
    } catch (err) {
      console.error('Upload failed', err);
      toast.error('Upload failed.');
    }
    setIsSaving(false);
  };

  const currentProduct = client.Product?.find((p: any) => p.id === productId);
  const activeStage = stages[activeStageIndex];

  const updateStage = (idx: number, patch: Record<string, string>) => {
    setStages(prev => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  };

  const addStage = () => {
    const stageOrder = stages.length + 1;
    setStages([...stages, { stageOrder, stageName: `Stage ${stageOrder}`, systemPrompt: '', checklistConfig: [] }]);
    setActiveStageIndex(stages.length);
  };

  const removeStage = (idx: number) => {
    setStages(stages.filter((_, i) => i !== idx).map((s, i) => ({ ...s, stageOrder: i + 1 })));
    setActiveStageIndex(Math.max(0, idx - 1));
  };

  const saveConfirmations: Record<Tab, ConfirmOptions> = {
    knowledge: {
      title: 'Save Knowledge Base',
      icon: 'menu_book',
      message: <>Save the knowledge base for <strong>{client.name}</strong>?</>,
      detail: "The AI uses it for every one of this client's leads from the next reply on.",
      confirmLabel: 'Save',
    },
    funnel: {
      title: 'Save Funnel Stages',
      icon: 'account_tree',
      message: <>Save {stages.length} funnel stage{stages.length === 1 ? '' : 's'} for <strong>{client.name}</strong>{currentProduct ? <> ({currentProduct.product_name})</> : null}?</>,
      detail: 'This replaces the saved stages and prompts. Leads use the new prompts from their next reply on.',
      confirmLabel: 'Save',
    },
    ghl: {
      title: 'Save GoHighLevel Settings',
      icon: 'forum',
      message: <>Save the GoHighLevel settings for <strong>{client.name}</strong>?</>,
      detail: ghlAutoReply
        ? 'Automatic replies are ON: the AI will reply to Facebook and Instagram DMs by itself.'
        : 'Automatic replies are off: replies are saved here as drafts only.',
      confirmLabel: 'Save',
    },
  };

  const save = async () => {
    if (!(await confirm(saveConfirmations[tab]))) return;
    setIsSaving(true);
    if (tab === 'knowledge') {
      const finalContext = [contextText.trim(), ...contextUrls].filter(Boolean).join('\n\n');
      await saveClientContext(client.id, finalContext);
      await onSaved();
      toast.success('Knowledge Base saved.');
    } else if (tab === 'ghl') {
      const res = await saveGhlSettings(client.id, { locationId: ghlLocationId, token: ghlToken, autoReply: ghlAutoReply });
      if (!res.success) {
        toast.error(res.error || 'Failed to save GoHighLevel settings.');
        setIsSaving(false);
        return;
      }
      await onSaved();
      toast.success('GoHighLevel settings saved.');
    } else {
      await saveClientStages(client.id, productId, stages.map(withChecklistConfig));
      onStagesSaved(await getClientStages(client.id, productId));
      toast.success('Funnel config saved.');
    }
    setIsSaving(false);
    onClose();
  };


  return (
    <>
      <div className="flex gap-6 border-b border-border mb-6">
        {TABS.map(t => (
          <button
            key={t.key}
            className={`pb-3 px-2 border-b-2 font-semibold text-sm transition-colors flex items-center gap-2 ${tab === t.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
            onClick={() => setTab(t.key)}
          >
            <span className="material-symbols-sharp text-[1.2rem]">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'ghl' && (
        <div className="space-y-5">
          <p className="text-sm text-muted-foreground">
            Connect this client&apos;s GHL sub-account. Facebook and Instagram DMs that GHL receives are sent here, and the AI&apos;s reply is sent back through GHL.
          </p>
          <div>
            <Label htmlFor="ghlLocationId" className="mb-2 block">Location ID</Label>
            <Input id="ghlLocationId" value={ghlLocationId} onChange={(e) => setGhlLocationId(e.target.value)} placeholder="GHL sub-account Location ID" />
          </div>
          <div>
            <Label htmlFor="ghlToken" className="mb-2 block">Private Integration Token</Label>
            <Input
              id="ghlToken"
              type="password"
              value={ghlToken}
              onChange={(e) => setGhlToken(e.target.value)}
              placeholder={client.ghlConnected ? 'Saved. Leave blank to keep it' : 'pit-...'}
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground mt-1">Needs read and write access to conversations and conversation messages.</p>
          </div>
          <label className="flex items-start gap-3 cursor-pointer">
            <Checkbox checked={ghlAutoReply} onCheckedChange={(v) => setGhlAutoReply(!!v)} className="mt-0.5" />
            <span className="text-sm">
              <span className="font-medium">Send replies automatically</span>
              <span className="block text-muted-foreground">When off, replies are only saved here as drafts.</span>
            </span>
          </label>
          <div className="rounded-md border border-border bg-secondary/30 p-3 text-xs space-y-1">
            <p className="font-semibold">Webhook URL for the GHL workflow</p>
            <code className="block break-all">{window.location.origin}/api/ghl/inbound?secret=YOUR_GHL_WEBHOOK_SECRET</code>
          </div>
        </div>
      )}

      {tab === 'knowledge' && (
        <div className="flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Additional Context Files (Optional)</h4>
            <Button type="button" variant="secondary" size="sm" onClick={() => {
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = '.pdf,.png,.jpg,.jpeg,.webp,.gif,.txt,.md,.csv,.docx';
              input.onchange = () => { if (input.files?.[0]) uploadContextFile(input.files[0]); };
              input.click();
            }} title="Upload File to R2">
              <span className="material-symbols-sharp mr-1 text-[1.1rem]">upload_file</span>
              Upload File
            </Button>
          </div>

          {contextUrls.length > 0 && (
            <div className="mb-6">
              <ul className="space-y-2">
                {contextUrls.map((url, i) => {
                  const filename = url.split('/').pop() || url;
                  return (
                    <li key={i} className="flex items-center gap-2 bg-secondary/50 p-2 rounded-md border border-border min-w-0">
                      <span className="material-symbols-sharp text-primary text-[1.1rem] shrink-0">draft</span>
                      <a href={url} target="_blank" rel="noreferrer" className="text-sm flex-1 truncate hover:underline min-w-0" title={filename}>
                        {filename}
                      </a>
                      <Button variant="outline" size="sm" className="h-7 text-xs shrink-0" onClick={() => setContextUrls(prev => prev.filter((_, idx) => idx !== i))}>
                        Remove
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <div className="mb-6 p-4 rounded-md border border-primary/20 bg-primary/5">
            <h4 className="text-sm font-semibold mb-3 text-primary uppercase tracking-wider flex items-center gap-2">
              <span className="material-symbols-sharp text-[1.1rem]">apartment</span>
              Client PVPs
            </h4>
            <div className="text-sm space-y-3 text-foreground">
              <div>
                <strong className="text-muted-foreground block text-xs mb-1">Value Proposition (VPS)</strong>
                <p className="whitespace-pre-wrap text-[13px]">{client.vps || 'None provided. Use "Sync Clients from Tools" to pull it in.'}</p>
              </div>
              <div>
                <strong className="text-muted-foreground block text-xs mb-1">Target Persona</strong>
                <p className="whitespace-pre-wrap text-[13px]">{client.persona || 'None provided'}</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-3 italic border-t border-primary/10 pt-2">
              This information is automatically injected into the AI&apos;s prompt for all of this client&apos;s leads, global or product.
            </p>
          </div>

          {currentProduct ? (
            <div className="mb-6 p-4 rounded-md border border-primary/20 bg-primary/5">
              <h4 className="text-sm font-semibold mb-3 text-primary uppercase tracking-wider flex items-center gap-2">
                <span className="material-symbols-sharp text-[1.1rem]">inventory_2</span>
                Product PVPs
              </h4>
              <div className="text-sm space-y-3 text-foreground">
                <div>
                  <strong className="text-muted-foreground block text-xs mb-1">Product Name</strong>
                  {currentProduct.product_name}
                </div>
                <div>
                  <strong className="text-muted-foreground block text-xs mb-1">Value Proposition (VPS)</strong>
                  <p className="whitespace-pre-wrap text-[13px]">{currentProduct.vps || 'None provided'}</p>
                </div>
                <div>
                  <strong className="text-muted-foreground block text-xs mb-1">Target Persona</strong>
                  <p className="whitespace-pre-wrap text-[13px]">{currentProduct.persona || 'None provided'}</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-3 italic border-t border-primary/10 pt-2">
                This information is automatically injected into the AI&apos;s prompt when generating drafts for this product&apos;s leads.
              </p>
            </div>
          ) : !productId && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground bg-secondary/10 rounded-lg border border-border border-dashed">
              <span className="material-symbols-sharp text-4xl mb-3 opacity-50">inventory_2</span>
              <p className="text-sm">Select a specific product from the client dropdown to view its PVPs here.</p>
            </div>
          )}
        </div>
      )}

      {tab === 'funnel' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">Define custom stages and the AI instruction for each stage.</p>
            <Button onClick={addStage} size="sm"><span className="material-symbols-sharp mr-1">add</span> Add Stage</Button>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {stages.map((stage, idx) => (
              <button
                key={idx}
                onClick={() => setActiveStageIndex(idx)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${activeStageIndex === idx ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'}`}
              >
                Stage {stage.stageOrder}
              </button>
            ))}
          </div>

          {activeStage && (
            <div key={activeStageIndex} className="border border-border rounded-md p-4 bg-secondary/20 relative group">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-4">
                <span className="font-bold shrink-0">Stage {activeStage.stageOrder}</span>
                <Input
                  value={activeStage.stageName}
                  onChange={(e) => updateStage(activeStageIndex, { stageName: e.target.value })}
                  placeholder="Stage Name"
                  className="w-full sm:max-w-[300px]"
                />
                <Button variant="ghost" size="icon" className="text-destructive sm:ml-auto opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity self-end sm:self-auto shrink-0" onClick={() => removeStage(activeStageIndex)}>
                  <span className="material-symbols-sharp">delete</span>
                </Button>
              </div>

              <Label className="mb-2 block text-sm font-medium">System Prompt</Label>
              <Textarea
                value={activeStage.systemPrompt}
                onChange={(e) => updateStage(activeStageIndex, { systemPrompt: e.target.value })}
                className="min-h-[250px] font-mono text-xs mb-4 resize-y bg-background"
                placeholder="You are an AI assistant..."
              />
            </div>
          )}
        </div>
      )}

      <DialogFooter className="mt-4 pt-4 border-t border-border">
        <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
          Cancel
        </Button>
        <Button type="button" onClick={save} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save Settings'}
        </Button>
      </DialogFooter>
      {confirmDialog}
    </>
  );
}
