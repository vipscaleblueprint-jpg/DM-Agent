'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { getLeadDetails, editConversationMessage, insertConversationMessage, setMessageStageFrom, deleteMessage } from '@/app/actions';
import { DateTimePicker, toLocalDateTimeValue } from '@/components/DateTimePicker';
import { ConfirmModal, useConfirm, type ConfirmOptions } from '@/components/modals/ConfirmModal';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

type StageProps = {
  stageLabel: (stage: number) => string;
  stageOptions: number[];
};

// Edit a lead's full conversation: text, date/time, who sent it, and where each stage starts
export function TimelineEditorModal({ open, onOpenChange, leadId, leadName, clientName, onChanged, ...stageProps }: StageProps & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string | null;
  leadName: string;
  clientName: string;
  onChanged: () => void; // after any change, so the open chat can refresh
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="material-symbols-sharp text-primary">history_edu</span>
            Timeline Editor
          </DialogTitle>
        </DialogHeader>
        {leadId && (
          <TimelineEditor key={leadId} leadId={leadId} leadName={leadName} clientName={clientName} onChanged={onChanged} {...stageProps} />
        )}
        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Unsaved edits per message id
type Draft = { content?: string; at?: string };

function TimelineEditor({ leadId, leadName, clientName, onChanged, stageLabel, stageOptions }: StageProps & {
  leadId: string;
  leadName: string;
  clientName: string;
  onChanged: () => void;
}) {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [stageTab, setStageTab] = useState(1);
  // Where the insert form is open: null = top of the list, a message id = after it, undefined = closed
  const [insertAfter, setInsertAfter] = useState<string | null | undefined>(undefined);
  const [deleteMsgId, setDeleteMsgId] = useState<string | null>(null);
  const { confirm, confirmDialog } = useConfirm();

  const load = () => getLeadDetails(leadId).then(data => {
    setMessages(data?.Conversation || []);
    setLoading(false);
  });

  // Remounted per lead (keyed), so this runs once per lead
  useEffect(() => {
    getLeadDetails(leadId).then(data => {
      setMessages(data?.Conversation || []);
      setLoading(false);
    });
  }, [leadId]);

  const reload = async () => {
    await load();
    onChanged();
  };

  const stageTabs = useMemo(() => {
    const nums = new Set<number>();
    messages.forEach(m => nums.add(m.stage ?? 1));
    return Array.from(nums).sort((a, b) => a - b);
  }, [messages]);

  const tabMessages = useMemo(() => messages.filter(m => m.stage === stageTab), [messages, stageTab]);

  const setDraft = (id: string, patch: Draft) => setDrafts(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const isDirty = (msg: any) => {
    const d = drafts[msg.id];
    if (!d) return false;
    return (d.content !== undefined && d.content !== msg.content)
      || (d.at !== undefined && d.at !== toLocalDateTimeValue(msg.createdAt));
  };

  const saveMessage = async (msg: any) => {
    const d = drafts[msg.id] || {};
    const content = d.content ?? msg.content;
    if (!content.trim()) return;
    const newTime = d.at && d.at !== toLocalDateTimeValue(msg.createdAt) ? new Date(d.at).toISOString() : undefined;
    const changes = [content !== msg.content && 'text', newTime && 'date and time'].filter(Boolean).join(' and ');
    if (!(await confirm({
      title: 'Save Message',
      icon: 'save',
      message: `Save the new ${changes} for this message?`,
      detail: newTime ? 'The message moves to its new place in the conversation.' : undefined,
      confirmLabel: 'Save',
    }))) return;
    await editConversationMessage(msg.id.toString(), content, undefined, newTime);
    toast.success('Message saved');
    setDrafts(prev => {
      const next = { ...prev };
      delete next[msg.id];
      return next;
    });
    await reload();
  };

  const changeRole = async (msg: any, role: 'user' | 'assistant') => {
    if (!(await confirm({
      title: 'Change Sender',
      icon: 'swap_horiz',
      message: <>Mark this message as sent by <strong>{role === 'user' ? leadName : clientName}</strong>?</>,
      detail: 'The AI reads the conversation by who said what, so this changes how it understands the chat.',
      confirmLabel: 'Change sender',
    }))) return;
    await editConversationMessage(msg.id.toString(), msg.content, role);
    toast.success(`Role updated to ${role === 'user' ? 'Lead' : 'AI'}`);
    await reload();
  };

  const confirmDelete = async () => {
    if (!deleteMsgId) return;
    const res = await deleteMessage(deleteMsgId);
    if (!res.success) {
      toast.error('Failed to delete message.');
      return;
    }
    toast.success('Message deleted');
    setDeleteMsgId(null);
    await reload();
  };

  const insertForm = (afterMsgId: string | null) => (
    <InsertForm
      confirm={confirm}
      leadId={leadId}
      afterMsgId={afterMsgId}
      messages={messages}
      stageLabel={stageLabel}
      stageOptions={stageOptions}
      onCancel={() => setInsertAfter(undefined)}
      onDone={async () => {
        setInsertAfter(undefined);
        await reload();
      }}
    />
  );

  const insertButton = (afterMsgId: string | null) => (
    <div className="flex justify-center py-1 opacity-60 hover:opacity-100 transition-opacity z-10 relative">
      <Button size="sm" variant="outline" className="h-6 rounded-full text-xs bg-background border-border shadow-sm gap-1 px-2.5" onClick={() => setInsertAfter(afterMsgId)} title="Insert a message, agent note or stage marker here">
        <span className="material-symbols-sharp text-[1rem]">add</span>
        <span>Insert</span>
      </Button>
    </div>
  );

  return (
    <div className="flex flex-col gap-3 py-2">
      {loading ? (
        <div className="text-sm text-muted-foreground animate-pulse py-8 text-center">Loading conversation history...</div>
      ) : messages.length === 0 ? (
        <div className="flex flex-col gap-3 py-4">
          <div className="text-sm text-muted-foreground text-center">No messages yet. Add earlier conversation history below.</div>
          {insertForm(null)}
        </div>
      ) : (
        <div className="space-y-2 max-h-[65vh] overflow-y-auto pr-2 custom-scrollbar">
          <div className="sticky top-0 z-20 flex items-center gap-2 py-2 bg-card overflow-x-auto [scrollbar-width:none]">
            {stageTabs.map(tab => (
              <button
                key={tab}
                onClick={() => setStageTab(tab)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${stageTab === tab ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'}`}
              >
                Stage {tab}
              </button>
            ))}
          </div>

          {insertButton(null)}
          {insertAfter === null && insertForm(null)}

          {tabMessages.map((msg, idx) => {
            const id = msg.id.toString();
            const draft = drafts[msg.id] || {};
            const dirty = isDirty(msg);
            return (
              <React.Fragment key={id}>
                {(idx === 0 || tabMessages[idx - 1].stage !== msg.stage) && (
                  <div className="flex items-center gap-4 py-4">
                    <div className="flex-1 h-[1px] bg-border"></div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-background px-3 border border-border rounded-full shadow-sm">
                      {stageLabel(msg.stage)} Started Here
                    </span>
                    <div className="flex-1 h-[1px] bg-border"></div>
                  </div>
                )}

                <div className="flex flex-col items-start gap-1.5 p-3 rounded-md border shadow-sm group transition-colors bg-card border-border hover:border-primary/20 hover:bg-card/80">
                  {msg.isNote ? (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase shrink-0 mt-0.5 tracking-wider bg-sky-500/15 text-sky-600" title="Private guidance for the AI. Never sent to the lead.">
                      Agent note
                    </span>
                  ) : (
                  <DropdownMenu>
                    <DropdownMenuTrigger className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase shrink-0 mt-0.5 tracking-wider cursor-pointer hover:opacity-80 transition-opacity outline-none ${msg.role === 'user' ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`} title="Change role">
                      {msg.role === 'user' ? leadName : clientName}
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem disabled={msg.role === 'assistant'} onClick={() => changeRole(msg, 'assistant')}>
                        {clientName} (assistant)
                      </DropdownMenuItem>
                      <DropdownMenuItem disabled={msg.role === 'user'} onClick={() => changeRole(msg, 'user')}>
                        {leadName} (user)
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  )}

                  <DateTimePicker
                    value={draft.at ?? toLocalDateTimeValue(msg.createdAt)}
                    onChange={value => setDraft(msg.id, { at: value })}
                    title="Date and time sent"
                  />

                  <div className="text-sm w-full flex flex-col group/msg">
                    <Textarea
                      value={draft.content ?? msg.content}
                      onChange={e => setDraft(msg.id, { content: e.target.value })}
                      className="text-sm min-h-[60px] bg-transparent border-transparent hover:border-input focus:border-input resize-y shadow-none focus-visible:ring-1 focus-visible:bg-background transition-all -ml-2 w-[calc(100%+1rem)]"
                    />
                    <div className={`flex justify-end gap-1.5 mt-1 transition-opacity ${dirty ? 'opacity-100' : 'opacity-0 group-hover/msg:opacity-100'}`}>
                      {dirty && (
                        <Button variant="secondary" size="sm" className="h-7 text-xs shadow-none border border-border/50" onClick={() => saveMessage(msg)}>
                          <span className="material-symbols-sharp text-[1.1rem] mr-1">save</span>Save
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => setDeleteMsgId(id)} title="Delete message">
                        <span className="material-symbols-sharp text-[1.1rem]">delete</span>
                      </Button>
                    </div>
                  </div>
                </div>

                {insertButton(id)}
                {insertAfter === id && insertForm(id)}
              </React.Fragment>
            );
          })}
        </div>
      )}

      <ConfirmModal
        destructive
        open={deleteMsgId !== null}
        onOpenChange={(open) => { if (!open) setDeleteMsgId(null); }}
        title="Delete Message"
        confirmLabel="Delete Message"
        busyLabel="Deleting..."
        onConfirm={confirmDelete}
      >
        <p className="text-sm text-foreground">Are you sure you want to delete this message?</p>
        <p className="text-sm text-muted-foreground">This action cannot be undone.</p>
      </ConfirmModal>
      {confirmDialog}
    </div>
  );
}

// Adds an earlier message, or a "stage starts here" marker, at a point in the timeline
function InsertForm({ confirm, leadId, afterMsgId, messages, stageLabel, stageOptions, onCancel, onDone }: StageProps & {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  leadId: string;
  afterMsgId: string | null;
  messages: any[];
  onCancel: () => void;
  onDone: () => Promise<void>;
}) {
  const [kind, setKind] = useState<'user' | 'assistant' | 'note' | 'stage'>('user');
  const [content, setContent] = useState('');
  const [markerStage, setMarkerStage] = useState(2);
  const [msgStage, setMsgStage] = useState<number | 'auto'>('auto');
  const canMark = messages.length > 0;

  const submit = async () => {
    if (kind === 'stage' && canMark) {
      const idx = afterMsgId === null ? 0 : messages.findIndex(m => m.id.toString() === afterMsgId) + 1;
      const next = messages[idx];
      if (!next) {
        toast.error('There is no message after this point to start the stage on.');
        return;
      }
      if (!(await confirm({
        title: 'Apply Stage Marker',
        icon: 'flag',
        message: <>Start <strong>{stageLabel(markerStage)}</strong> at this point?</>,
        detail: 'The next message, and everything after it up to the next stage change, moves to this stage.',
        confirmLabel: 'Apply',
      }))) return;
      await setMessageStageFrom(leadId, next.id.toString(), markerStage);
      toast.success(`Stage ${markerStage} marker applied`);
    } else {
      if (!content.trim()) return;
      if (!(await confirm({
        title: 'Insert Message',
        icon: 'add_comment',
        message: kind === 'note' ? 'Add this note for the AI at this point in the conversation?' : `Insert this ${kind === 'assistant' ? 'AI' : 'lead'} message into the conversation?`,
        detail: kind === 'note'
          ? 'The AI follows it from its next reply on. It is never sent to the lead and does not affect follow-up timing.'
          : 'It is placed at this point in the timeline.',
        confirmLabel: kind === 'note' ? 'Add note' : 'Insert',
      }))) return;
      await insertConversationMessage(leadId, kind === 'stage' ? 'user' : kind, content, afterMsgId, msgStage === 'auto' ? undefined : msgStage);
      toast.success(kind === 'note' ? 'Note added' : 'Message inserted');
    }
    await onDone();
  };

  return (
    <div className="bg-secondary/40 p-3 rounded-md border border-border flex flex-col gap-2 shadow-inner">
      <div className="flex gap-2">
        <Button variant={kind === 'user' ? 'default' : 'outline'} size="sm" onClick={() => setKind('user')} className="h-7 text-xs">Lead</Button>
        <Button variant={kind === 'assistant' ? 'default' : 'outline'} size="sm" onClick={() => setKind('assistant')} className="h-7 text-xs">AI Draft</Button>
        <Button variant={kind === 'note' ? 'default' : 'outline'} size="sm" onClick={() => setKind('note')} className="h-7 text-xs" title="Private guidance for the AI. Never sent to the lead.">Agent Note</Button>
        {canMark && (
          <Button variant={kind === 'stage' ? 'default' : 'outline'} size="sm" onClick={() => setKind('stage')} className="h-7 text-xs">Stage Marker</Button>
        )}
      </div>
      {kind === 'stage' && canMark ? (
        <div className="flex flex-col gap-1.5">
          <select
            value={markerStage}
            onChange={e => setMarkerStage(parseInt(e.target.value, 10))}
            className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {stageOptions.map(num => (
              <option key={num} value={num}>{stageLabel(num)}</option>
            ))}
          </select>
          <span className="text-xs text-muted-foreground">The message right after this point, and everything following it up to the next stage change, is moved to this stage.</span>
        </div>
      ) : (
        <>
          <Textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder={kind === 'note' ? "Tell the AI what to do, e.g. Don't mention the price yet, ask about their schedule first." : 'Type new message...'}
            className="text-sm min-h-[60px]"
          />
          <select
            value={msgStage}
            onChange={e => setMsgStage(e.target.value === 'auto' ? 'auto' : parseInt(e.target.value, 10))}
            className="flex h-9 w-full items-center rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="auto">Stage: same as surrounding messages</option>
            {stageOptions.map(num => (
              <option key={num} value={num}>{stageLabel(num)}</option>
            ))}
          </select>
        </>
      )}
      <div className="flex justify-end gap-2 mt-1">
        <Button variant="outline" size="sm" onClick={onCancel} className="h-7 text-xs">Cancel</Button>
        <Button size="sm" className="h-7 text-xs" onClick={submit}>{kind === 'stage' ? 'Apply' : 'Insert'}</Button>
      </div>
    </div>
  );
}
