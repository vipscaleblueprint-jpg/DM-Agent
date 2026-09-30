'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import { LiveTime } from '@/components/LiveTime';
import { LeadStatePanel } from '@/components/LeadStatePanel';
import {
  AddClientModal,
  AddProductModal,
  ClientSettingsModal,
  ConfirmModal,
  useConfirm,
  DebugPromptModal,
  LeadFormModal,
  MessageTimeModal,
  TimelineEditorModal,
  type LeadFormValues,
} from '@/components/modals';
import { getFollowUpStatus, isValidTimezone, browserTimezone } from '@/lib/followup';
import { setLeadQualification, setLeadDone, getLeads, getLeadDetails, generateDraftResponse, addLead, sendLeadMessage, getFullSystemPrompt, editLead, removeLead, editConversationMessage, learnFromCorrection, deleteMessage, getClients, getClientStage, getClientStages, syncVipscaleClients, syncLeadFromGhl } from './actions';
import { Button } from "@/components/ui/button";
import Loader from "@/components/ui/loader";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuCheckboxItem
} from "@/components/ui/dropdown-menu";

function formatExternalUrl(url: string) {
  if (!url) return '';
  if (!/^https?:\/\//i.test(url)) {
    return 'https://' + url;
  }
  return url;
}

export default function DMApp() {
  const [leads, setLeads] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [activeClientId, setActiveClientId] = useState<string | null>(null);
  const [activeProductId, setActiveProductId] = useState<string | null>(null);
  const [activeLeadId, setActiveLeadId] = useState<string | null>(null);
  const [showMobileDetails, setShowMobileDetails] = useState(false);
  const [leadDetails, setLeadDetails] = useState<any>(null);
  const [activeStageConfig, setActiveStageConfig] = useState<any>(null);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingLeads, setIsLoadingLeads] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [leadTab, setLeadTab] = useState<'all' | 'followup' | 'done' | 'not_qualified'>('all');
  const [leadSort, setLeadSort] = useState<'default' | 'latest' | 'oldest' | 'name'>('default');
  const [leadStageFilter, setLeadStageFilter] = useState<string[]>([]);
  const [leadHotFilter, setLeadHotFilter] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [funnelStages, setFunnelStages] = useState<any[]>([]);
  const [activeChatStage, setActiveChatStage] = useState<number | 'all'>('all');

  // Editing a message inline in the chat
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [extractGlobalLesson, setExtractGlobalLesson] = useState(true);

  // Dialogs (each one lives in src/components/modals)
  const [showAddLead, setShowAddLead] = useState(false);
  const [showEditLead, setShowEditLead] = useState(false);
  const [showAddClient, setShowAddClient] = useState(false);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showClientSettings, setShowClientSettings] = useState(false);
  const [showSendTimeModal, setShowSendTimeModal] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [timelineLeadId, setTimelineLeadId] = useState<string | null>(null);
  const [showDeleteLead, setShowDeleteLead] = useState(false);
  const [deleteLeadTarget, setDeleteLeadTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteChatMsgId, setDeleteChatMsgId] = useState<string | null>(null);
  const [showDebugModal, setShowDebugModal] = useState(false);
  const [debugPromptText, setDebugPromptText] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { confirm, confirmDialog } = useConfirm();

  const fetchLeads = async (clientId?: string, productId?: string | null) => {
    try {
      setIsLoadingLeads(true);
      const targetClient = clientId || activeClientId;
      const targetProduct = productId !== undefined ? productId : activeProductId;
      if (!targetClient) {
        setIsLoadingLeads(false);
        return;
      }
      // Each lead comes with its lastMessage preview and every message's sender/time (for follow-up timing)
      setLeads(await getLeads(targetClient, targetProduct || undefined));
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingLeads(false);
    }
  };

  const fetchLeadDetails = async (id: string) => {
    try {
      const data = await getLeadDetails(id);
      const details = JSON.parse(JSON.stringify(data));
      setLeadDetails(details);
      // Keep the sidebar's follow-up state in sync when messages/timezone change
      if (details?.Conversation) {
        const messages = details.Conversation
          .map((m: any) => ({ role: m.role, createdAt: m.createdAt, autoDraft: m.autoDraft }))
          .reverse();
        const last = details.Conversation[details.Conversation.length - 1];
        const lastMessage = last
          ? { role: last.role, content: String(last.content).replace(/\s+/g, ' ').trim().slice(0, 140), createdAt: last.createdAt }
          : null;
        setLeads(prev => prev.map(l => l.id === id ? { ...l, timezone: details.timezone, Conversation: messages, lastMessage } : l));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const initClients = async () => {
    try {
      const clientsData = await getClients();
      setClients(clientsData);
      if (clientsData.length > 0) {
        const savedClientId = localStorage.getItem('lastActiveClientId');
        const savedProductId = localStorage.getItem('lastActiveProductId');
        const foundClient = clientsData.find((c: any) => c.id === savedClientId);
        
        if (savedClientId && foundClient) {
          setActiveClientId(savedClientId);
          if (savedProductId && foundClient.Product?.some((p: any) => p.id === savedProductId)) {
            setActiveProductId(savedProductId);
          } else {
            setActiveProductId(null);
          }
        } else {
          setActiveClientId(clientsData[0].id);
          setActiveProductId(null);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    initClients();
  }, []);

  useEffect(() => {
    if (activeClientId) {
      localStorage.setItem('lastActiveClientId', activeClientId);
      if (activeProductId) {
        localStorage.setItem('lastActiveProductId', activeProductId);
      } else {
        localStorage.removeItem('lastActiveProductId');
      }
      fetchLeads(activeClientId, activeProductId);
      setActiveLeadId(null);
      setLeadDetails(null);
    }
  }, [activeClientId, activeProductId]);

  useEffect(() => {
    if (!activeClientId) return;
    getClientStages(activeClientId, activeProductId).then(setFunnelStages).catch(err => console.error(err));
  }, [activeClientId]);

  useEffect(() => {
    if (activeLeadId) {
      setActiveChatStage('all');
      fetchLeadDetails(activeLeadId);
      setInputText('');
      // Show the stored chat right away, then pull in anything sent directly in GHL
      let cancelled = false;
      syncLeadFromGhl(activeLeadId).then(res => {
        if (!cancelled && res.added > 0) fetchLeadDetails(activeLeadId);
      });
      return () => { cancelled = true; };
    }
  }, [activeLeadId]);

  useEffect(() => {
    if (leadDetails?.LeadState?.stage && activeClientId) {
      getClientStage(activeClientId, leadDetails.LeadState.stage).then(res => {
        setActiveStageConfig(res);
      }).catch(err => console.error(err));
    } else {
      setActiveStageConfig(null);
    }
  }, [leadDetails?.LeadState?.stage, activeClientId]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [leadDetails?.Conversation]);

  const activeClient = clients.find(c => c.id === activeClientId);

  const handleAddLead = async ({ name, fbLink, timezone }: LeadFormValues) => {
    if (!activeClientId) return;
    const newId = await addLead(name, fbLink, activeClientId, activeProductId, timezone || null);
    await fetchLeads(activeClientId);
    setActiveLeadId(newId);
    setShowAddLead(false);
  };

  const handleEditLead = async ({ name, fbLink, timezone }: LeadFormValues) => {
    if (!activeLeadId) return;
    await editLead(activeLeadId, name, fbLink, timezone || null);
    await fetchLeads();
    await fetchLeadDetails(activeLeadId);
    setShowEditLead(false);
  };

  const handleClientCreated = (client: any) => {
    setClients(prev => [client, ...prev]);
    setActiveClientId(client.id);
    setShowAddClient(false);
  };

  const handleSyncClients = async () => {
    setIsLoading(true);
    toast.info('Syncing clients from tools...');
    const res = await syncVipscaleClients();
    if (res.success) {
      toast.success(`Synced ${res.count} clients from tools!`);
      await initClients(); // Refresh client list
    } else {
      toast.error(res.error || 'Failed to sync clients');
    }
    setIsLoading(false);
  };

  const setDone = async (lead: { id: string; name: string }, done: boolean) => {
    await setLeadDone(lead.id, done);
    await fetchLeads();
    if (activeLeadId === lead.id) await fetchLeadDetails(lead.id);
    toast.success(done ? `${lead.name} moved to Done` : `${lead.name} moved back to Leads`);
  };

  // Marking as done asks first; moving back to Leads doesn't
  const handleToggleDone = async (lead: any) => {
    if (lead.LeadState?.leadStatus === 'DONE') {
      await setDone(lead, false);
      return;
    }
    const ok = await confirm({
      title: 'Mark as Done',
      icon: 'task_alt',
      message: <>Mark <strong>{lead.name}</strong> as done? Use this when they have already availed the service or product.</>,
      detail: 'They will move to the Done tab and stop getting follow-ups. If they message again about something new, the AI can move them back to Leads.',
      confirmLabel: 'Mark as done',
    });
    if (ok) await setDone(lead, true);
  };

  const handleToggleNotQualified = async (lead: any) => {
    const next = lead.LeadState?.leadStatus !== 'NOT_QUALIFIED';
    const ok = await confirm(next ? {
      title: 'Mark as Not Qualified',
      icon: 'person_off',
      message: <>Mark <strong>{lead.name}</strong> as not qualified?</>,
      detail: 'They will move to the Not qualified tab, stop getting follow-ups, and GoHighLevel messages from them will be saved without an AI reply.',
      confirmLabel: 'Mark as not qualified',
    } : {
      title: 'Mark as Qualified',
      icon: 'how_to_reg',
      message: <>Mark <strong>{lead.name}</strong> as qualified again?</>,
      detail: 'They will move back to Leads, and follow-ups and AI replies resume.',
      confirmLabel: 'Mark as qualified',
    });
    if (!ok) return;
    await setLeadQualification(lead.id, next);
    await fetchLeads();
    if (activeLeadId === lead.id) await fetchLeadDetails(lead.id);
    toast.success(next ? `${lead.name} moved to Not qualified` : `${lead.name} marked as qualified`);
  };

  const openTimeline = (leadId: string) => {
    setTimelineLeadId(leadId);
    setShowTimeline(true);
  };

  const askDeleteLead = (lead: { id: string; name: string }) => {
    setDeleteLeadTarget({ id: lead.id, name: lead.name });
    setShowDeleteLead(true);
  };

  const confirmDeleteLead = async () => {
    if (!deleteLeadTarget) return;
    try {
      await removeLead(deleteLeadTarget.id);
      if (deleteLeadTarget.id === activeLeadId) {
        setActiveLeadId(null);
        setLeadDetails(null);
      }
      await fetchLeads();
      setShowDeleteLead(false);
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete lead. Check database connection.');
    }
  };

  const confirmDeleteChatMessage = async () => {
    if (!deleteChatMsgId) return;
    const res = await deleteMessage(deleteChatMsgId);
    if (!res.success) {
      toast.error('Failed to delete message.');
      return;
    }
    toast.success('Message deleted');
    setDeleteChatMsgId(null);
    if (activeLeadId) await fetchLeadDetails(activeLeadId);
  };

  const handleShowDebugPrompt = async () => {
    if (!leadDetails?.LeadState?.stage) return;
    try {
      const full = await getFullSystemPrompt(leadDetails.id, leadDetails.client_id);
      const attachments = full.attachments.length > 0 ? full.attachments.join('\n') : '(none)';
      setDebugPromptText(
        `===== SYSTEM PROMPT =====\n${full.systemPrompt}\n\n` +
        `===== ATTACHED FILES (images/PDFs from client context links) =====\n${attachments}\n\n` +
        `===== MESSAGE SENT TO MODEL =====\nChat History:\n${full.chatHistory || '(no messages yet)'}`
      );
      setShowDebugModal(true);
    } catch (e) {
      console.error('Failed to load debug prompt', e);
    }
  };

  const handleSendMessage = () => {
    if (!leadDetails || !inputText.trim()) return;
    setShowSendTimeModal(true);
  };

  const confirmSendMessage = async (sentAt: Date) => {
    if (!leadDetails || !inputText.trim()) return;

    setShowSendTimeModal(false);
    setIsLoading(true);
    await sendLeadMessage(leadDetails.id, inputText, sentAt);
    setInputText('');
    
    // Fetch immediately so the user's message shows up in the UI
    await fetchLeadDetails(activeLeadId as string);
    
    const res = await generateDraftResponse(leadDetails.id, leadDetails.client_id);
    if (!res.success) {
      toast.error(`Draft generation failed: ${res.error}`);
    }

    await fetchLeadDetails(activeLeadId as string);
    setIsLoading(false);
  };

  const handleRegenerateDraft = async (messageId: string) => {
    if (!leadDetails) return;
    
    setIsLoading(true);
    
    await deleteMessage(messageId);
    
    const res = await generateDraftResponse(leadDetails.id, leadDetails.client_id);
    
    if (res.success) {
      await fetchLeadDetails(activeLeadId as string);
    } else {
      toast.error(`Regeneration failed: ${res.error}`);
    }
    setIsLoading(false);
  };

  const handleNoResponseFollowUp = async () => {
    if (!leadDetails || !leadDetails.Conversation?.length) return;
    const lastMsg = leadDetails.Conversation[leadDetails.Conversation.length - 1];
    if (lastMsg.role !== 'assistant') {
      toast.error("The last message must be from the AI to simulate a non-response follow-up.");
      return;
    }
    
    setIsLoading(true);
    const res = await generateDraftResponse(leadDetails.id, leadDetails.client_id);
    
    if (res.success) {
      setInputText('');
      await fetchLeadDetails(activeLeadId as string);
    } else {
      toast.error(`Draft generation failed: ${res.error}`);
    }
    setIsLoading(false);
  };

  const handleSaveEdit = async (msg: any) => {
    if (!editingMessageId) return;
    // The lesson checkbox is only offered on AI messages
    const learnLesson = msg.role === 'assistant' && extractGlobalLesson && msg.content !== editingContent;
    const ok = await confirm(msg.role === 'user' ? {
      title: 'Save Edited Message',
      icon: 'edit',
      message: <>Save your changes to <strong>{leadDetails?.name}</strong>&apos;s message?</>,
      detail: "The AI will then draft a new reply. If the AI's last reply is the latest message, it is replaced.",
      confirmLabel: 'Save and re-draft',
    } : {
      title: 'Save Edited Message',
      icon: 'edit',
      message: 'Save your changes to this AI message?',
      detail: learnLesson ? `The AI will also learn a rule from your correction and add it to ${leadDetails?.Client?.name || "the client"}'s knowledge base.` : undefined,
      confirmLabel: 'Save',
    });
    if (!ok) return;
    setIsLoading(true);
    
    await editConversationMessage(editingMessageId, editingContent);
    
    if (learnLesson) {
      const res = await learnFromCorrection(leadDetails.client_id, msg.content, editingContent);
      if (res.success) {
        toast.success(`Learned new rule:\n"${res.rule}"\n\nThis has been added to Global Context.`);
      } else {
        toast.error(`Failed to extract lesson: ${res.error}`);
      }
    }
    
    setEditingMessageId(null);
    
    if (msg.role === 'user') {
      await fetchLeadDetails(activeLeadId as string);
      
      // Remove the last AI draft if it exists so we can generate a fresh one
      if (leadDetails?.Conversation?.length) {
         const lastMsg = leadDetails.Conversation[leadDetails.Conversation.length - 1];
         if (lastMsg.role === 'assistant') {
            await deleteMessage(lastMsg.id);
         }
      }

      const res = await generateDraftResponse(leadDetails.id, leadDetails.client_id);
      if (!res.success) {
        toast.error(`Draft generation failed: ${res.error}`);
      }
    }

    await fetchLeadDetails(activeLeadId as string);
    setIsLoading(false);
  };

  // Tick every minute so the follow-up list stays current
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  // Follow-up status per lead, based on the lead's timezone (falls back to the client's, then this browser's).
  // Not-qualified and Done leads are closed out, so they never get one.
  const clientTz = clients.find(c => c.id === activeClientId)?.timezone;
  const followUpStatuses = useMemo(() => {
    const map = new Map<string, NonNullable<ReturnType<typeof getFollowUpStatus>>>();
    for (const lead of leads) {
      if (lead.LeadState?.leadStatus === 'NOT_QUALIFIED' || lead.LeadState?.leadStatus === 'DONE') continue;
      const tz = isValidTimezone(lead.timezone) ? lead.timezone : isValidTimezone(clientTz) ? clientTz : browserTimezone();
      const status = getFollowUpStatus(lead.Conversation, tz);
      if (status) map.set(lead.id, status);
    }
    return map;
  }, [leads, clientTz]);

  const isNotQualified = (lead: any) => lead.LeadState?.leadStatus === 'NOT_QUALIFIED';
  const isDone = (lead: any) => lead.LeadState?.leadStatus === 'DONE';

  // The AI already drafted the follow-up automatically and it hasn't been reviewed yet
  const hasDraftReady = (lead: any) => lead.Conversation?.[0]?.autoDraft === true;

  // Meta-style list time: today -> clock time, this week -> weekday, older -> "15 Sep"
  const formatListTime = (iso: string) => {
    const d = new Date(iso);
    if (new Date(nowMs).toDateString() === d.toDateString()) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    if (nowMs - d.getTime() < 7 * 86_400_000) return d.toLocaleDateString([], { weekday: 'short' });
    return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
  };

  const followUpLeads = useMemo(() => {
    return leads
      .filter(lead => {
        if (isNotQualified(lead) || isDone(lead)) return false;
        const st = followUpStatuses.get(lead.id);
        return hasDraftReady(lead) || (st && st.dueAt <= nowMs);
      })
      .sort((a, b) => {
        // Drafts waiting for review first, then longest-overdue
        const da = hasDraftReady(a) ? 0 : 1, db = hasDraftReady(b) ? 0 : 1;
        if (da !== db) return da - db;
        return (followUpStatuses.get(a.id)?.dueAt ?? 0) - (followUpStatuses.get(b.id)?.dueAt ?? 0);
      });
  }, [leads, followUpStatuses, nowMs]);

  const filteredLeads = useMemo(() => {
    let list = leadTab === 'followup' ? followUpLeads
      : leadTab === 'not_qualified' ? leads.filter(isNotQualified)
      : leadTab === 'done' ? leads.filter(isDone)
      : leads.filter(lead => !isNotQualified(lead) && !isDone(lead));
    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      list = list.filter(lead =>
        (lead.name || '').toLowerCase().includes(lowerQuery) ||
        (lead.fb_link || '').toLowerCase().includes(lowerQuery)
      );
    }
    if (leadStageFilter.length > 0) {
      list = list.filter(lead => leadStageFilter.includes(String(lead.LeadState?.stage ?? 1)));
    }
    if (leadHotFilter) {
      list = list.filter(lead => lead.LeadState?.leadStatus === 'HOT');
    }
    if (leadSort === 'default') return list; // tab order: newest lead first, or most overdue first for Follow Up
    const lastAt = (lead: any) => (lead.lastMessage ? new Date(lead.lastMessage.createdAt).getTime() : 0);
    return [...list].sort((a, b) => {
      if (leadSort === 'name') return (a.name || '').localeCompare(b.name || '');
      return leadSort === 'latest' ? lastAt(b) - lastAt(a) : lastAt(a) - lastAt(b);
    });
  }, [leads, followUpLeads, leadTab, searchQuery, leadStageFilter, leadSort, leadHotFilter]);

  const stageLabel = (num: number) => {
    const name = funnelStages.find((st: any) => st.stageOrder === num)?.stageName;
    return name ? `Stage ${num}: ${name}` : `Stage ${num}`;
  };
  // Stages configured for this client; fall back to 1-6 if none are set up yet
  const stageOptions = funnelStages.length > 0 ? funnelStages.map((st: any) => st.stageOrder as number) : [1, 2, 3, 4, 5, 6];

  const chatStages = useMemo(() => {
    const nums = new Set<number>();
    (leadDetails?.Conversation || []).forEach((m: any) => nums.add(m.stage ?? 1));
    if (leadDetails?.LeadState?.stage) nums.add(leadDetails.LeadState.stage);
    return Array.from(nums).sort((a, b) => a - b);
  }, [leadDetails]);

  const visibleMessages = useMemo(() => {
    const all: any[] = leadDetails?.Conversation || [];
    return activeChatStage === 'all' ? all : all.filter(m => m.stage === activeChatStage);
  }, [leadDetails, activeChatStage]);

  const filteredClients = useMemo(() => {
    if (!clientSearchQuery) return clients;
    const lowerQuery = clientSearchQuery.toLowerCase();
    return clients.filter(c => (c.name || '').toLowerCase().includes(lowerQuery));
  }, [clients, clientSearchQuery]);

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden p-3 gap-3">
      {/* Top Header */}
      <div className="px-3 pt-3 pb-3 shrink-0 flex items-center justify-start gap-4 min-h-[60px] border-b border-border/10">
        <h2 className="flex items-center gap-2 font-bold tracking-tight text-[18px] whitespace-nowrap">
          <span className="material-symbols-sharp text-primary text-[1.6rem]">smart_toy</span>
          DM Agent
        </h2>
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md border border-border bg-card hover:bg-secondary text-card-foreground transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring shadow-sm min-w-0 max-w-[250px]">
            <div className="flex items-center gap-3 overflow-hidden text-left">
              <div className="flex items-center justify-center w-8 h-8 rounded-md bg-primary/20 text-primary shrink-0">
                <span className="material-symbols-sharp text-[1.2rem]">apartment</span>
              </div>
              <div className="flex flex-col min-w-0 justify-center">
                <span className="font-bold truncate text-[15px] leading-none text-foreground">
                  {clients.find(c => c.id === activeClientId)?.name || 'Loading...'}
                </span>
                {activeProductId && (
                  <span className="text-[11px] text-muted-foreground truncate mt-1 leading-none">
                    {clients.find(c => c.id === activeClientId)?.Product?.find((p:any) => p.id === activeProductId)?.product_name}
                  </span>
                )}
              </div>
            </div>
            <span className="material-symbols-sharp text-muted-foreground shrink-0 text-[1.1rem]">unfold_more</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[280px]">
            <div className="p-2 border-b border-border mb-1">
              <div className="relative">
                <span className="material-symbols-sharp absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-[1.1rem]">search</span>
                <Input 
                  autoFocus
                  placeholder="Search clients..."
                  value={clientSearchQuery}
                  onChange={e => setClientSearchQuery(e.target.value)}
                  onKeyDown={e => e.stopPropagation()}
                  className="h-8 pl-8 text-xs"
                />
              </div>
            </div>
            <div className="max-h-[300px] overflow-y-auto">
              {filteredClients.length === 0 ? (
                 <div className="py-3 text-center text-xs text-muted-foreground">No clients found</div>
              ) : (
                filteredClients.map(client => {
                  const hasProducts = client.Product && client.Product.length > 0;
                  const isActiveClient = activeClientId === client.id;
                  
                  return (
                    <DropdownMenuSub key={client.id}>
                      <DropdownMenuSubTrigger className={`flex items-center justify-between ${isActiveClient ? 'bg-primary/10 text-primary font-medium' : ''}`}>
                        <span>{client.name}</span>
                        {isActiveClient && <span className="material-symbols-sharp text-primary text-[1.1rem] ml-2">check</span>}
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent>
                        <DropdownMenuItem onClick={() => { setActiveClientId(client.id); setActiveProductId(null); }} className="flex justify-between font-semibold">
                          <span>Global Leads (No Product)</span>
                          {isActiveClient && activeProductId === null && <span className="material-symbols-sharp text-primary text-[1.1rem] ml-2">check</span>}
                        </DropdownMenuItem>
                        
                        {hasProducts && (
                          <>
                            <DropdownMenuSeparator />
                            {client.Product.map((prod: any) => (
                              <DropdownMenuItem key={prod.id} onClick={() => { setActiveClientId(client.id); setActiveProductId(prod.id); }} className="flex justify-between">
                                <span>{prod.product_name}</span>
                                {isActiveClient && activeProductId === prod.id && <span className="material-symbols-sharp text-primary text-[1.1rem] ml-2">check</span>}
                              </DropdownMenuItem>
                            ))}
                          </>
                        )}
                        
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => {
                          setActiveClientId(client.id);
                          setShowAddProduct(true);
                        }}>
                          <span className="material-symbols-sharp mr-2 text-[1.1rem] text-muted-foreground">add</span>
                          Add Product
                        </DropdownMenuItem>
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  );
                }))}
            </div>
            <div className="h-px bg-border my-1 mx-2" />
            {process.env.NODE_ENV === 'development' && (
              <DropdownMenuItem onClick={handleSyncClients} disabled={isLoading}>
                <span className="material-symbols-sharp mr-2 text-[1.1rem] text-muted-foreground">sync</span>
                Sync Clients from Tools (Dev Only)
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => setShowClientSettings(true)}>
              <span className="material-symbols-sharp mr-2 text-[1.1rem] text-muted-foreground">settings</span>
              Client Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setShowAddClient(true)}>
              <span className="material-symbols-sharp mr-2 text-[1.1rem] text-muted-foreground">add</span>
              Add New Client
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        
        {activeClientId && clients.find(c => c.id === activeClientId)?.timezone && (
          <div className="ml-auto hidden md:flex items-center bg-card border border-border px-3 py-1.5 rounded-md shadow-sm">
            <LiveTime timezone={clients.find(c => c.id === activeClientId)?.timezone} label="Client Time" />
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col lg:flex-row h-full min-h-0 overflow-hidden gap-3">
        
        {/* Left + Middle wrapper */}
        <div className="flex-1 flex flex-col h-full min-h-0 min-w-0 bg-card border border-border rounded-xl overflow-hidden">
          {/* Tabs Row */}
          <div className="px-3 py-2.5 flex items-center justify-between border-b border-border shrink-0">
            <div className="flex items-center gap-1.5 text-[13px] font-medium">
              {([
                ['all', 'Leads'],
                ['followup', `Follow Up${followUpLeads.length > 0 ? ` (${followUpLeads.length})` : ''}`],
                ['done', `Done${leads.some(isDone) ? ` (${leads.filter(isDone).length})` : ''}`],
                ['not_qualified', `Not qualified${leads.some(isNotQualified) ? ` (${leads.filter(isNotQualified).length})` : ''}`],
              ] as const).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setLeadTab(key)}
                  className={`px-3.5 py-1.5 rounded-lg whitespace-nowrap transition-colors ${leadTab === key ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <Button size="sm" className="h-8 text-white font-medium px-4 bg-gradient-to-r from-purple-500 to-pink-500 hover:opacity-90 border-0 rounded-md shadow-sm transition-opacity" onClick={() => setShowAddLead(true)} disabled={isLoading} title="Add Lead">
              <span className="material-symbols-sharp text-[1.2rem] mr-1">add</span> Add Lead
            </Button>
          </div>

          
          <div className="flex-1 flex flex-col md:grid h-full min-h-0 md:grid-cols-[350px_1fr] lg:grid-cols-[380px_1fr] overflow-hidden">
            {/* Sidebar - Leads List */}
            <aside className={`flex flex-col h-full min-h-0 bg-card border-r border-border overflow-hidden ${activeLeadId ? 'hidden md:flex' : 'flex'}`} >
              {/* Search Row */}
              <div className="p-3 border-b border-border shrink-0 flex items-center gap-2">
                <div className="relative flex-1 min-w-0">
                  <span className="material-symbols-sharp absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-[1.1rem]">search</span>
                  <Input
                    type="text"
                    placeholder="Search Leads..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-9 text-sm bg-muted/30 border-transparent rounded-full hover:bg-muted/50 focus-visible:bg-background focus-visible:border-primary/50 transition-colors"
                  />
                </div>

                {/* Sort */}
                <DropdownMenu>
                  <DropdownMenuTrigger
                    title="Sort"
                    className={`h-9 w-9 shrink-0 inline-flex items-center justify-center rounded-full border transition-colors outline-none ${leadSort !== 'default' ? 'bg-primary/15 border-primary/40 text-primary' : 'border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground'}`}
                  >
                    <span className="material-symbols-sharp text-[1.15rem]">swap_vert</span>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-[13rem]">
                    <DropdownMenuGroup>
                      <DropdownMenuLabel>Sort by</DropdownMenuLabel>
                      <DropdownMenuRadioGroup value={leadSort} onValueChange={(v) => setLeadSort(v as typeof leadSort)}>
                        <DropdownMenuRadioItem value="default">Default</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="latest">Latest message</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="oldest">Oldest message</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="name">Name (A-Z)</DropdownMenuRadioItem>
                      </DropdownMenuRadioGroup>
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Filter by stage */}
                <DropdownMenu>
                  <DropdownMenuTrigger
                    title="Filter"
                    className={`h-9 w-9 shrink-0 inline-flex items-center justify-center rounded-full border transition-colors outline-none ${leadStageFilter.length > 0 || leadHotFilter ? 'bg-primary/15 border-primary/40 text-primary' : 'border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground'}`}
                  >
                    <span className="material-symbols-sharp text-[1.15rem]">filter_list</span>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-[14rem]">
                    <DropdownMenuGroup>
                      <DropdownMenuLabel>Current stage</DropdownMenuLabel>
                      <DropdownMenuCheckboxItem
                        checked={leadStageFilter.length === 0}
                        onCheckedChange={(checked) => checked && setLeadStageFilter([])}
                      >
                        All stages
                      </DropdownMenuCheckboxItem>
                      {stageOptions.map(num => {
                        const val = String(num);
                        const isChecked = leadStageFilter.includes(val);
                        return (
                          <DropdownMenuCheckboxItem 
                            key={num} 
                            checked={isChecked}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setLeadStageFilter(prev => [...prev, val]);
                              } else {
                                setLeadStageFilter(prev => prev.filter(v => v !== val));
                              }
                            }}
                          >
                            {stageLabel(num)}
                          </DropdownMenuCheckboxItem>
                        );
                      })}
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel>Status</DropdownMenuLabel>
                      <DropdownMenuCheckboxItem
                        checked={leadHotFilter}
                        onCheckedChange={setLeadHotFilter}
                      >
                        Hot Deals 🔥
                      </DropdownMenuCheckboxItem>
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Scrollable leads list */}
              <ul className="flex-1 overflow-y-auto min-h-0" style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {isLoadingLeads ? (
            Array.from({ length: 5 }).map((_, i) => (
              <li key={i} className="flex items-center gap-3 p-4 border-b border-border">
                <div className="w-10 h-10 rounded-full bg-muted animate-pulse shrink-0" />
                <div className="flex flex-col gap-2 flex-1">
                  <div className="h-4 bg-muted animate-pulse rounded w-3/4" />
                  <div className="h-3 bg-muted animate-pulse rounded w-1/2" />
                </div>
              </li>
            ))
          ) : (
            <>
              {filteredLeads.map((lead) => {
                return (
                <li 
                  key={lead.id} 
                  className={`relative flex items-start gap-3 mx-2 my-1 px-3 py-2.5 rounded-lg cursor-pointer transition-colors hover:bg-surface-hover group ${activeLeadId === lead.id ? "bg-surface-hover" : ""}`}
                  onClick={() => {
                    if (activeLeadId !== lead.id) {
                      setActiveLeadId(lead.id);
                      setLeadDetails(null);
                    }
                  }}
                >
                  <span className="material-symbols-sharp shrink-0 text-muted-foreground" style={{ fontSize: '2.2rem' }}>
                    account_circle
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span className="block font-medium text-sm truncate pr-12">
                      {lead.name}
                    </span>
                    <div className={`text-xs mt-0.5 truncate ${lead.lastMessage?.role === 'user' ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                      {lead.lastMessage
                        ? `${lead.lastMessage.role === 'assistant' ? 'You: ' : ''}${lead.lastMessage.content}`
                        : (lead.fb_link || 'No messages yet')}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      <span className="text-[0.65rem] rounded-full bg-primary/10 text-primary px-2 py-0.5" title={stageLabel(lead.LeadState?.stage ?? 1)}>
                        Stage {lead.LeadState?.stage ?? 1}
                      </span>

                      {lead.LeadState?.leadStatus === 'HOT' && (
                        <span className="text-[0.65rem] rounded-full bg-red-500/15 text-red-500 px-2 py-0.5 font-semibold" title="Ready to seriously consider the offer">
                          HOT
                        </span>
                      )}
                      {lead.LeadState?.leadStatus === 'NOT_QUALIFIED' && (
                        <span className="text-[0.65rem] rounded-full bg-zinc-500/20 text-zinc-400 px-2 py-0.5" title={lead.LeadState.leadStatusManual ? 'Flagged as not qualified by you' : 'Detected as not qualified by the AI'}>
                          Not qualified
                        </span>
                      )}
                      {isDone(lead) && (
                        <span className="text-[0.65rem] rounded-full bg-emerald-500/15 text-emerald-500 px-2 py-0.5" title={lead.LeadState.leadStatusManual ? 'Moved to Done by you' : 'Detected as done by the AI'}>
                          Done
                        </span>
                      )}
                      {hasDraftReady(lead) && (
                        <span className="text-[0.65rem] rounded-full bg-blue-500/15 text-blue-500 px-2 py-0.5" title="The AI drafted a follow-up for this lead. Review it and send.">
                          Draft ready
                        </span>
                      )}
                    </div>
                  </div>
                  {lead.lastMessage && (
                    <span className="absolute top-3.5 right-3.5 text-[0.7rem] text-muted-foreground transition-opacity group-hover:opacity-0 group-has-[[data-popup-open]]:opacity-0">
                      {formatListTime(lead.lastMessage.createdAt)}
                    </span>
                  )}
                  <div className="absolute top-2 right-2" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger className="h-7 w-7 inline-flex items-center justify-center rounded-md opacity-0 group-hover:opacity-100 data-[popup-open]:opacity-100 transition-opacity hover:bg-muted text-muted-foreground outline-none">
                        <span className="material-symbols-sharp text-[1.2rem]">more_horiz</span>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-[14rem]">
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          openTimeline(lead.id);
                        }}>
                          <span className="material-symbols-sharp mr-2 text-[1.1rem]">memory</span>
                          Edit Long Term Memory
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          setTimeout(() => handleToggleDone(lead), 10);
                        }}>
                          <span className="material-symbols-sharp mr-2 text-[1.1rem]">{isDone(lead) ? 'undo' : 'task_alt'}</span>
                          {isDone(lead) ? 'Move back to Leads' : 'Mark as done'}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          setTimeout(() => handleToggleNotQualified(lead), 10);
                        }}>
                          <span className="material-symbols-sharp mr-2 text-[1.1rem]">{isNotQualified(lead) ? 'how_to_reg' : 'person_off'}</span>
                          {isNotQualified(lead) ? 'Mark as qualified' : 'Mark as not qualified'}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            setTimeout(() => askDeleteLead(lead), 10);
                          }}
                        >
                          <span className="material-symbols-sharp mr-2 text-[1.1rem]">delete</span>
                          Remove Lead
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </li>
                );
              })}
              {filteredLeads.length === 0 && (
                <div style={{ padding: '1.5rem', color: 'var(--muted)', fontSize: '0.9rem', textAlign: 'center' }}>
                  No leads found.
                </div>
              )}
            </>
          )}
        </ul>


      </aside>

      {/* Main Workspace Area (Chat Interface) */}
      <main className={`flex flex-col h-full min-h-0 overflow-hidden bg-card ${!activeLeadId ? 'hidden md:flex' : 'flex w-full'}`}>
        {leadDetails ? (
          <>
            {/* Header */}
            <header className="flex justify-between items-center shrink-0 p-5 px-6 border-b border-border bg-card shadow-sm z-10">
              <div className="flex items-center">
                <Button variant="ghost" size="icon" className="md:hidden mr-3 -ml-3" onClick={() => setActiveLeadId(null)}>
                  <span className="material-symbols-sharp">arrow_back</span>
                </Button>
                <div className="flex flex-col">
                  <h3 className="text-xl font-bold flex items-center gap-2 m-0 text-foreground">
                    {leadDetails.name}
                  </h3>
                  {leadDetails.fb_link && (
                    <a href={formatExternalUrl(leadDetails.fb_link)} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline mt-1 truncate max-w-[200px] md:max-w-[400px]">
                      {leadDetails.fb_link}
                    </a>
                  )}
                  <div className="flex flex-wrap items-center gap-4 mt-1">
                    {leadDetails.timezone && (
                      <LiveTime timezone={leadDetails.timezone} label="Lead" />
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 ml-auto">
                <Button variant="outline" size="sm" className="lg:hidden" onClick={() => setShowMobileDetails(true)}>
                  <span className="material-symbols-sharp mr-2 text-[1.2rem]">info</span>
                  Info
                </Button>

                <div className="flex items-center gap-1">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="w-9 h-9 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-md"
                    title="Edit Lead"
                    onClick={() => setShowEditLead(true)}
                  >
                    <span className="material-symbols-sharp text-[1.3rem]">edit</span>
                  </Button>

                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="w-9 h-9 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-md"
                    title="Edit Long Term Memory"
                    onClick={() => openTimeline(leadDetails.id)}
                  >
                    <span className="material-symbols-sharp text-[1.3rem]">memory</span>
                  </Button>
                  
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`w-9 h-9 rounded-md hover:bg-emerald-500/10 ${isDone(leadDetails) ? 'text-emerald-500' : 'text-muted-foreground hover:text-emerald-500'}`}
                    title={isDone(leadDetails) ? 'Move back to Leads' : 'Mark as done (already availed)'}
                    onClick={() => handleToggleDone(leadDetails)}
                  >
                    <span className="material-symbols-sharp text-[1.3rem]">{isDone(leadDetails) ? 'undo' : 'task_alt'}</span>
                  </Button>

                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="w-9 h-9 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-md"
                    title={isNotQualified(leadDetails) ? 'Mark as qualified' : 'Mark as not qualified'}
                    onClick={() => handleToggleNotQualified(leadDetails)}
                  >
                    <span className="material-symbols-sharp text-[1.3rem]">{isNotQualified(leadDetails) ? 'how_to_reg' : 'person_off'}</span>
                  </Button>

                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="w-9 h-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md"
                    title="Remove Lead"
                    onClick={() => askDeleteLead(leadDetails)}
                  >
                    <span className="material-symbols-sharp text-[1.3rem]">delete</span>
                  </Button>
                </div>
              </div>
              <Sheet open={showMobileDetails} onOpenChange={setShowMobileDetails}>
                <SheetContent side="right" className="w-[85vw] sm:w-[400px] overflow-y-auto bg-card p-0 flex flex-col h-full border-l border-border">
                  <LeadStatePanel leadDetails={leadDetails} activeStageConfig={activeStageConfig} onShowDebugPrompt={handleShowDebugPrompt} />
                </SheetContent>
              </Sheet>
            </header>
            
            {/* Chat Sub-header */}
            <div className="shrink-0 flex items-center justify-between px-6 py-2 border-b border-border bg-card">
              <div className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none]">
              {chatStages.length > 1 && (
                (['all', ...chatStages] as (number | 'all')[]).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveChatStage(tab)}
                    className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap border transition-colors ${activeChatStage === tab ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-border hover:text-foreground'}`}
                  >
                    {tab === 'all' ? 'All' : stageLabel(tab)}
                    {tab === leadDetails?.LeadState?.stage ? ' •' : ''}
                  </button>
                ))
              )}
              </div>
              
            </div>

            {/* Scrollable Message History */}
            <div className="flex-1 overflow-y-scroll min-h-0 p-6 flex flex-col gap-6 bg-background">

              {(!leadDetails.Conversation || leadDetails.Conversation.length === 0) ? (
                <div className="m-auto text-muted-foreground text-center flex flex-col items-center gap-2">
                  <span className="material-symbols-sharp text-4xl opacity-50">chat_bubble</span>
                  <p>No messages yet. Send a message to start the funnel.</p>
                </div>
              ) : (
                visibleMessages.map((msg: any, index: number) => {
                  const currentMsgDate = msg.createdAt ? new Date(msg.createdAt).toDateString() : null;
                  const prevMsgDate = index > 0 && visibleMessages[index - 1].createdAt ? new Date(visibleMessages[index - 1].createdAt).toDateString() : null;
                  const showDateDivider = currentMsgDate && currentMsgDate !== prevMsgDate;
                  const formattedDividerDate = msg.createdAt ? new Date(msg.createdAt).toLocaleString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }) : '';
                  const dividerId = currentMsgDate ? `date-divider-${new Date(currentMsgDate).getTime()}` : '';
                  
                  return (
                  <React.Fragment key={msg.id.toString()}>
                    {showDateDivider && (
                      <div id={dividerId} className="flex items-center justify-center my-4 relative">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-border"></div>
                        </div>
                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger className="relative bg-background px-4 text-xs font-medium text-muted-foreground rounded-full border border-border py-1 shadow-sm hover:bg-surface-hover hover:text-foreground transition-colors cursor-pointer flex items-center gap-1 focus:outline-none">
                              {formattedDividerDate}
                              <span className="material-symbols-sharp text-[0.9rem] opacity-70">expand_more</span>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="center" className="w-56 bg-popover border-border text-popover-foreground p-1">
                            <div className="px-2 py-1.5 text-xs text-muted-foreground font-medium">Jump to...</div>
                            <DropdownMenuItem className="focus:bg-primary focus:text-primary-foreground cursor-pointer text-sm" onClick={() => {
                               const ts = new Date(new Date().toDateString()).getTime();
                               const div = Array.from(document.querySelectorAll('[id^="date-divider-"]')).reverse().find(d => parseInt(d.id.replace('date-divider-', '')) <= ts);
                               if (div) div.scrollIntoView({ behavior: 'smooth', block: 'center' });
                               else toast.info("No messages found.");
                            }}>Today</DropdownMenuItem>
                            <DropdownMenuItem className="focus:bg-primary focus:text-primary-foreground cursor-pointer text-sm" onClick={() => {
                               const ts = new Date(new Date(Date.now() - 86400000).toDateString()).getTime();
                               const div = Array.from(document.querySelectorAll('[id^="date-divider-"]')).reverse().find(d => parseInt(d.id.replace('date-divider-', '')) <= ts);
                               if (div) div.scrollIntoView({ behavior: 'smooth', block: 'center' });
                               else toast.info("No messages found.");
                            }}>Yesterday</DropdownMenuItem>
                            <DropdownMenuItem className="focus:bg-primary focus:text-primary-foreground cursor-pointer text-sm" onClick={() => {
                               const ts = new Date(new Date(Date.now() - 7 * 86400000).toDateString()).getTime();
                               const div = Array.from(document.querySelectorAll('[id^="date-divider-"]')).reverse().find(d => parseInt(d.id.replace('date-divider-', '')) <= ts);
                               if (div) div.scrollIntoView({ behavior: 'smooth', block: 'center' });
                               else toast.info("No messages found.");
                            }}>Last week</DropdownMenuItem>
                            <DropdownMenuItem className="focus:bg-primary focus:text-primary-foreground cursor-pointer text-sm" onClick={() => {
                               const ts = new Date(new Date(Date.now() - 30 * 86400000).toDateString()).getTime();
                               const div = Array.from(document.querySelectorAll('[id^="date-divider-"]')).reverse().find(d => parseInt(d.id.replace('date-divider-', '')) <= ts);
                               if (div) div.scrollIntoView({ behavior: 'smooth', block: 'center' });
                               else toast.info("No messages found.");
                            }}>Last month</DropdownMenuItem>
                            <DropdownMenuItem className="focus:bg-primary focus:text-primary-foreground cursor-pointer text-sm" onClick={() => {
                              const firstMsg = document.querySelector('[id^="date-divider-"]');
                              if (firstMsg) firstMsg.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }}>The very beginning</DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-border" />
                            <DropdownMenuItem className="focus:bg-primary focus:text-primary-foreground cursor-pointer text-sm" onClick={() => toast.info("Specific date jumping not yet implemented.")}>Jump to a specific date</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    )}
                  <div className={`flex flex-col max-w-[90%] md:max-w-[75%] ${msg.role === 'user' ? 'self-end items-end' : 'self-start items-start'}`}>
                    
                    {/* Header */}
                    <div className={`flex items-center gap-3 mb-1.5 px-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                       <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                         {msg.role === 'user' ? (leadDetails?.name || 'Lead') : (leadDetails?.Client?.name || 'AI Draft')}
                       </span>
                       <div className="relative group flex items-center">
                         <span 
                           className="text-[10px] text-muted-foreground/70 cursor-pointer"
                         >
                           {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : ''}
                         </span>
                         <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block whitespace-nowrap bg-zinc-800 text-zinc-100 text-[10px] py-1 px-2 rounded shadow-lg z-50">
                           {msg.createdAt ? new Date(msg.createdAt).toLocaleString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : ''}
                           <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-zinc-800"></div>
                         </div>
                       </div>
                       <div className={`flex gap-2 items-center ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                          <button onClick={() => { navigator.clipboard.writeText(msg.content); toast.success('Copied!'); }} className="text-muted-foreground hover:text-foreground transition-colors" title="Copy">
                            <span className="material-symbols-sharp" style={{fontSize: '1rem'}}>content_copy</span>
                          </button>
                          {msg.role === 'assistant' && (
                            <button onClick={() => handleRegenerateDraft(msg.id.toString())} className="text-muted-foreground hover:text-foreground transition-colors" title="Regenerate" disabled={isLoading}>
                              <span className="material-symbols-sharp" style={{fontSize: '1rem'}}>autorenew</span>
                            </button>
                          )}
                          {editingMessageId !== msg.id.toString() && (
                            <button onClick={() => { setEditingMessageId(msg.id.toString()); setEditingContent(msg.content); }} className="text-muted-foreground hover:text-foreground transition-colors" title="Edit">
                              <span className="material-symbols-sharp" style={{fontSize: '1rem'}}>edit</span>
                            </button>
                          )}
                          <button onClick={() => setDeleteChatMsgId(msg.id.toString())} className="text-muted-foreground hover:text-destructive transition-colors" title="Delete">
                            <span className="material-symbols-sharp" style={{fontSize: '1rem'}}>delete</span>
                          </button>
                       </div>
                    </div>
                    
                    {/* Bubble */}
                    <div className={`p-4 rounded-2xl shadow-sm min-w-[60px] ${msg.role === 'user' ? 'bg-primary/20 text-foreground border border-primary/30 rounded-tr-[4px]' : 'bg-card text-card-foreground border border-border rounded-tl-[4px]'}`}>
                      {editingMessageId === msg.id.toString() ? (
                        <div className="mt-2 min-w-[300px] md:min-w-[400px]">
                          <textarea 
                            value={editingContent}
                            onChange={e => setEditingContent(e.target.value)}
                            className="w-full min-h-[120px] p-3 rounded-md border border-border bg-background text-foreground text-sm font-sans resize-y focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                          <div className="flex items-center justify-between mt-3">
                            {msg.role === 'assistant' ? (
                              <label className="text-xs flex items-center gap-2 text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                                <input type="checkbox" checked={extractGlobalLesson} onChange={e => setExtractGlobalLesson(e.target.checked)} className="rounded border-border bg-background" />
                                Extract Global Lesson
                              </label>
                            ) : (
                              <div></div>
                            )}
                            <div className="flex gap-2">
                              <button onClick={() => setEditingMessageId(null)} className="px-3 py-1.5 bg-secondary text-secondary-foreground text-xs font-medium rounded-md hover:bg-secondary/80 transition-colors">Cancel</button>
                              <button onClick={() => handleSaveEdit(msg)} className="px-3 py-1.5 bg-primary text-primary-foreground text-xs font-medium rounded-md hover:bg-primary/90 transition-colors" disabled={isLoading}>Save</button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="whitespace-pre-wrap break-words leading-relaxed text-[15px]">
                          {msg.content}
                        </div>
                      )}
                    </div>
                  </div>
                  </React.Fragment>
                );
                })
              )}
              {isLoading && (
                <div className="flex flex-col self-start max-w-[90%] md:max-w-[75%] items-start">
                   {/* Header */}
                   <div className="flex items-center gap-3 mb-1.5 px-2 flex-row">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                        {leadDetails?.Client?.name || 'AI Draft'}
                      </span>
                   </div>
                   
                   <div className="p-4 rounded-2xl shadow-sm bg-card text-card-foreground border border-border rounded-tl-[4px]">
                      <div className="flex gap-1.5 items-center h-5 px-1 py-1">
                       <div className="w-2 h-2 rounded-full bg-primary/40 animate-pulse" style={{ animationDelay: '0ms' }}></div>
                       <div className="w-2 h-2 rounded-full bg-primary/40 animate-pulse" style={{ animationDelay: '200ms' }}></div>
                       <div className="w-2 h-2 rounded-full bg-primary/40 animate-pulse" style={{ animationDelay: '400ms' }}></div>
                     </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Bottom Controls & Input Area */}
            <div className="shrink-0 bg-card border-t border-border flex flex-col relative">
              {/* Chat Input */}
              <div className="p-4 flex gap-3 items-end bg-card">
                <Textarea
                  className="flex-1 h-[100px] min-h-[100px] max-h-[100px] bg-background resize-none overflow-y-auto shadow-inner rounded-xl"
                  placeholder="Simulate a message from the lead..."
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  disabled={isLoading}
                />
                <div className="flex flex-col justify-between h-[100px] shrink-0">
                  <Button
                    className="w-[46px] h-[46px] rounded-full shadow-md shrink-0 p-0 flex items-center justify-center bg-primary text-primary-foreground hover:opacity-90 border-0"
                    onClick={handleNoResponseFollowUp}
                    disabled={
                      isLoading ||
                      !leadDetails ||
                      isNotQualified(leadDetails) ||
                      isDone(leadDetails) ||
                      !(hasDraftReady(leadDetails) || ((followUpStatuses.get(leadDetails.id)?.dueAt ?? Infinity) <= nowMs))
                    }
                    title={
                      (!leadDetails || isNotQualified(leadDetails) || isDone(leadDetails) || !(hasDraftReady(leadDetails) || ((followUpStatuses.get(leadDetails.id)?.dueAt ?? Infinity) <= nowMs)))
                        ? "Lead doesn't need a follow-up right now"
                        : "Follow Up: draft a follow-up message"
                    }
                  >
                    <span className="material-symbols-sharp text-[1.4rem]" style={{ fontVariationSettings: "'FILL' 1" }}>schedule</span>
                  </Button>
                  <Button
                    className="w-[46px] h-[46px] rounded-full shadow-md shrink-0 p-0 flex items-center justify-center bg-primary text-primary-foreground hover:opacity-90 border-0"
                    onClick={handleSendMessage}
                    disabled={isLoading || !inputText.trim()}
                    title="Send"
                  >
                    <span className="material-symbols-sharp text-[1.4rem]">send</span>
                  </Button>
                </div>
              </div>
            </div>
          </>
        ) : activeLeadId ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-4">
             <Loader />
             <p className="text-sm font-medium mt-4">Loading lead...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-4">
             <span className="material-symbols-sharp text-5xl opacity-20">forum</span>
             <p className="text-lg font-medium">Select a lead to start chatting</p>
          </div>
        )}
      </main>
          </div>
        </div>

      {/* Right Sidebar - State Inspector (Desktop) */}
      <aside className="hidden lg:flex flex-col h-full bg-card border border-border rounded-xl overflow-hidden min-h-0 w-[350px] shrink-0" >
        <LeadStatePanel leadDetails={leadDetails} activeStageConfig={activeStageConfig} onShowDebugPrompt={handleShowDebugPrompt} />
      </aside>
      </div>

      <LeadFormModal open={showAddLead} onOpenChange={setShowAddLead} mode="add" onSubmit={handleAddLead} />
      <LeadFormModal
        open={showEditLead}
        onOpenChange={setShowEditLead}
        mode="edit"
        initial={leadDetails ? { name: leadDetails.name, fbLink: leadDetails.fb_link || '', timezone: leadDetails.timezone || '' } : undefined}
        onSubmit={handleEditLead}
      />

      <TimelineEditorModal
        open={showTimeline}
        onOpenChange={setShowTimeline}
        leadId={timelineLeadId}
        leadName={leads.find(l => l.id === timelineLeadId)?.name || 'Lead'}
        clientName={activeClient?.name || 'AI'}
        stageLabel={stageLabel}
        stageOptions={stageOptions}
        onChanged={() => { if (timelineLeadId && timelineLeadId === activeLeadId) fetchLeadDetails(timelineLeadId); }}
      />

      {confirmDialog}

      <ConfirmModal destructive open={showDeleteLead} onOpenChange={setShowDeleteLead} title="Delete Lead" confirmLabel="Delete Lead" busyLabel="Deleting..." onConfirm={confirmDeleteLead}>
        <p className="text-sm text-foreground">
          Are you sure you want to delete <strong>{deleteLeadTarget?.name}</strong>?
        </p>
        <p className="text-sm text-muted-foreground">
          All chat history, state, and context for this lead will be permanently deleted. This action cannot be undone.
        </p>
      </ConfirmModal>

      <ConfirmModal
        destructive
        open={deleteChatMsgId !== null}
        onOpenChange={(open) => { if (!open) setDeleteChatMsgId(null); }}
        title="Delete Message"
        confirmLabel="Delete Message"
        busyLabel="Deleting..."
        onConfirm={confirmDeleteChatMessage}
      >
        <p className="text-sm text-foreground">Are you sure you want to delete this message?</p>
        <p className="text-sm text-muted-foreground">This action cannot be undone.</p>
      </ConfirmModal>

      <ClientSettingsModal
        open={showClientSettings}
        onOpenChange={setShowClientSettings}
        client={activeClient}
        productId={activeProductId}
        onSaved={initClients}
        onStagesSaved={setFunnelStages}
      />

      <DebugPromptModal open={showDebugModal} onOpenChange={setShowDebugModal} stage={leadDetails?.LeadState?.stage} promptText={debugPromptText} />
      <AddProductModal open={showAddProduct} onOpenChange={setShowAddProduct} client={activeClient} onSaved={initClients} />
      <AddClientModal open={showAddClient} onOpenChange={setShowAddClient} onCreated={handleClientCreated} />
      <MessageTimeModal open={showSendTimeModal} onOpenChange={setShowSendTimeModal} onConfirm={confirmSendMessage} />
    </div>
  );
}

