'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import { TimezoneSelect } from '@/components/TimezoneSelect';
import { getFollowUpStatus, isValidTimezone, browserTimezone } from '@/lib/followup';
import { setLeadQualification, getLeads, editLeadMemory, editStructuredLeadMemory, insertConversationMessage, setMessageStageFrom, getLeadDetails, generateDraftResponse, addLead, getPresignedUrl, sendLeadMessage, saveClientContext, uploadFileToR2, getGlobalClient, getPromptForStage, getFullSystemPrompt, editLead, removeLead, editConversationMessage, learnFromCorrection, deleteMessage, getClients, addClient, getClientStage, editClient, getClientStages, saveClientStages, syncVipscaleClients } from './actions';
import { Button } from "@/components/ui/button";
import Loader from "@/components/ui/loader";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
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

const RightSidebarContent = ({ activeLeadId, leadDetails, activeStageConfig, handleShowDebugPrompt, setEditLeadName, setEditLeadFbLink, setEditLeadTimezone, setShowEditLead, setShowDeleteLead }: any) => {
  return (
    <>
      <div className="flex-1 overflow-y-auto min-h-0" style={{ padding: '1.5rem' }}>
        <h2>Lead State</h2>
        <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
          Real-time view of the agent's memory.
        </p>

        {leadDetails?.LeadState ? (
          <>
            <div className="bg-background border border-border rounded-md p-4 mb-6">
              <h3><span className="material-symbols-sharp" style={{ fontSize: '1.2rem' }}>analytics</span> Classification</h3>
              <div className="flex justify-between mb-2 text-sm">
                <span className="text-muted-foreground">Stage</span>
                <span className={`badge stage-${leadDetails.LeadState.stage}`}>
                  Stage {leadDetails.LeadState.stage}: {leadDetails.LeadState.stageName}
                </span>
              </div>
              <div className="flex justify-between mb-2 text-sm">
                <span className="text-muted-foreground">Primary Intent</span>
                <span className="font-medium text-right max-w-[60%]">{leadDetails.LeadState.primary_intent_id || 'UNKNOWN'}</span>
              </div>
              <div className="flex justify-between mb-2 text-sm">
                <span className="text-muted-foreground">Connection</span>
                <span className="font-medium text-right max-w-[60%]">{leadDetails.LeadState.connectionLevel}</span>
              </div>
              <div className="flex justify-between mb-2 text-sm">
                <span className="text-muted-foreground">Lead Status</span>
                <span className={`font-medium text-right max-w-[60%] ${leadDetails.LeadState.leadStatus === 'HOT' ? 'text-red-500' : leadDetails.LeadState.leadStatus === 'NOT_QUALIFIED' ? 'text-zinc-400' : ''}`}>
                  {leadDetails.LeadState.leadStatus === 'HOT' ? 'HOT' : leadDetails.LeadState.leadStatus === 'NOT_QUALIFIED' ? 'Not qualified' : 'Not hot'}
                  {leadDetails.LeadState.leadStatus === 'NOT_QUALIFIED' && leadDetails.LeadState.leadStatusManual ? ' (flagged)' : ''}
                </span>
              </div>
            </div>

            {activeStageConfig?.checklistConfig && activeStageConfig.checklistConfig.length > 0 ? (
              <div className="bg-background border border-border rounded-md p-4 mb-6">
                <h3><span className="material-symbols-sharp" style={{ fontSize: '1.2rem' }}>fact_check</span> Stage {leadDetails.LeadState.stage} Assessment</h3>
                
                {activeStageConfig.checklistConfig.map((item: any) => {
                  const val = leadDetails.LeadState.assessmentData ? leadDetails.LeadState.assessmentData[item.id] : undefined;
                  
                  if (item.type === 'boolean') {
                    return (
                      <div key={item.id} className="flex justify-between items-center mb-2 text-sm">
                        <span className="text-muted-foreground">{item.label}</span>
                        {val ? 
                          <span className="text-green-500 flex items-center gap-1"><span className="material-symbols-sharp text-[1rem]">check_circle</span> Captured</span> : 
                          <span className="text-destructive flex items-center gap-1"><span className="material-symbols-sharp text-[1rem]">cancel</span> Missing</span>}
                      </div>
                    );
                  } else {
                    return (
                      <div key={item.id} className="flex justify-between mb-2 text-sm" style={{ flexDirection: 'column', gap: '0.25rem', alignItems: 'flex-start' }}>
                        <span className="text-muted-foreground" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.label}</span>
                        <span className="font-medium text-right max-w-[100%]" style={{ textAlign: 'left', fontWeight: 400, color: 'var(--foreground)', lineHeight: 1.4 }}>
                          {val || '-'}
                        </span>
                      </div>
                    );
                  }
                })}

                <div className="mt-4 pt-3 border-t border-border flex flex-col gap-1">
                  <span className="text-muted-foreground" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Summary</span>
                  <span className="text-sm font-medium">{leadDetails.LeadState.leadSummary || 'No summary yet.'}</span>
                </div>
              </div>
            ) : (
              <div className="bg-background border border-border rounded-md p-4 mb-6">
                <h3><span className="material-symbols-sharp" style={{ fontSize: '1.2rem' }}>fact_check</span> Stage {leadDetails.LeadState.stage} Assessment</h3>
                <div className="text-sm text-muted-foreground italic mb-4">No checklist criteria defined for this stage.</div>
                
                <div className="pt-3 border-t border-border flex flex-col gap-1">
                  <span className="text-muted-foreground" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Summary</span>
                  <span className="text-sm font-medium">{leadDetails.LeadState.leadSummary || 'No summary yet.'}</span>
                </div>
              </div>
            )}

            <div className="bg-background border border-border rounded-md p-4 mb-6">
              <h3><span className="material-symbols-sharp" style={{ fontSize: '1.2rem' }}>lightbulb</span> Diagnostics</h3>
              <div className="flex justify-between mb-2 text-sm" style={{ flexDirection: 'column', gap: '0.25rem', alignItems: 'flex-start' }}>
                <span className="text-muted-foreground" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Next Stage Requirement</span>
                <span className="font-medium text-right max-w-[60%]" style={{ textAlign: 'left', maxWidth: '100%', fontWeight: 500, color: 'var(--foreground)', lineHeight: 1.4 }}>
                  {leadDetails.LeadState.nextStageRequirement || 'None identified yet.'}
                </span>
              </div>
            </div>

            <div className="bg-background border border-border rounded-md p-4 mb-6" style={{ background: 'rgba(234, 179, 8, 0.05)', border: '1px solid rgba(234, 179, 8, 0.2)' }}>
              <h3 style={{ color: 'hsl(var(--primary))' }}><span className="material-symbols-sharp" style={{ fontSize: '1.2rem' }}>bug_report</span> Debug Logs</h3>
              <div className="flex justify-between mb-2 text-sm" style={{ flexDirection: 'column', gap: '0.25rem', alignItems: 'flex-start' }}>
                <span className="text-muted-foreground" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Reason for Stage {leadDetails.LeadState.stage}</span>
                <span className="font-medium text-right max-w-[60%]" style={{ textAlign: 'left', maxWidth: '100%', fontWeight: 400, color: 'var(--foreground)', lineHeight: 1.4 }}>
                  {leadDetails.LeadState.lastStageChangeReason || 'No reasoning captured yet.'}
                </span>
              </div>
              <button 
                className="inline-flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground font-medium rounded-md border border-border hover:bg-secondary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" 
                style={{ width: '100%', marginTop: '0.75rem', padding: '0.4rem', fontSize: '0.8rem' }}
                onClick={handleShowDebugPrompt}
              >
                View Active System Prompt
              </button>
            </div>
          </>
        ) : (
          <div style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
            {leadDetails ? 'No state initialized for this lead.' : 'Select a lead to inspect their state.'}
          </div>
        )}
      </div>

    </>
  );
};

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
  const [contextText, setContextText] = useState('');
  const [contextUrls, setContextUrls] = useState<string[]>([]);
  const [isSavingContext, setIsSavingContext] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingLeads, setIsLoadingLeads] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [leadTab, setLeadTab] = useState<'all' | 'followup' | 'not_qualified'>('all');
  const [leadSort, setLeadSort] = useState<'default' | 'latest' | 'oldest' | 'name'>('default');
  const [leadStageFilter, setLeadStageFilter] = useState<string[]>([]);
  const [leadHotFilter, setLeadHotFilter] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  
  // Edit Structured Memory Modal State
  const [showEditMemory, setShowEditMemory] = useState(false);
  const [editMemoryLeadId, setEditMemoryLeadId] = useState('');
  const [editMemoryStage, setEditMemoryStage] = useState(1);
  const [editMemoryConnection, setEditMemoryConnection] = useState('LOW');
  const [editMemoryIntent, setEditMemoryIntent] = useState('');
  const [editMemoryAssessment, setEditMemoryAssessment] = useState<any>({});
  const [editMemoryConversations, setEditMemoryConversations] = useState<any[]>([]);
  const [editMemoryText, setEditMemoryText] = useState('');
  const [isMemoryLoading, setIsMemoryLoading] = useState(false);
  const [insertTargetMsgId, setInsertTargetMsgId] = useState<string | null | undefined>(undefined);
  const [insertRole, setInsertRole] = useState<'user' | 'assistant' | 'stage'>('user');
  const [insertContent, setInsertContent] = useState('');
  const [insertStage, setInsertStage] = useState(2);
  const [insertMsgStage, setInsertMsgStage] = useState<number | 'auto'>('auto');
  const [funnelStages, setFunnelStages] = useState<any[]>([]);
  const [deleteMsgId, setDeleteMsgId] = useState<string | null>(null);
  const [isDeletingMsg, setIsDeletingMsg] = useState(false);
  const [timelineStage, setTimelineStage] = useState<number | 'all'>('all');
  const [activeChatStage, setActiveChatStage] = useState<number | 'all'>('all');
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editingMsgContent, setEditingMsgContent] = useState('');
  
  const [activeSettingsTab, setActiveSettingsTab] = useState<'knowledge' | 'funnel'>('knowledge');
  const [clientStagesState, setClientStagesState] = useState<any[]>([]);
  const [activeStageIndex, setActiveStageIndex] = useState(0);
  
  // Add Lead Modal State
  const [showAddLead, setShowAddLead] = useState(false);
  const [newLeadName, setNewLeadName] = useState('');
  const [newLeadFbLink, setNewLeadFbLink] = useState('');
  const [newLeadTimezone, setNewLeadTimezone] = useState('');

  // Add Product Modal State
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [newProductAbout, setNewProductAbout] = useState('');
  const [newProductPvps, setNewProductPvps] = useState<string | null>(null);
  const [isGeneratingPvps, setIsGeneratingPvps] = useState(false);
  const [isSavingProduct, setIsSavingProduct] = useState(false);

  // Add Client Modal State
  const [showAddClient, setShowAddClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  
  const [showEditClient, setShowEditClient] = useState(false);
  const [editClientName, setEditClientName] = useState('');

  // Edit Lead Modal State
  const [showEditLead, setShowEditLead] = useState(false);
  const [editLeadName, setEditLeadName] = useState('');
  const [editLeadFbLink, setEditLeadFbLink] = useState('');
  const [editLeadTimezone, setEditLeadTimezone] = useState('');

  // Delete Lead Modal State
  const [showDeleteLead, setShowDeleteLead] = useState(false);
  // Set when removing a lead from the sidebar menu; null means the currently open lead
  const [deleteLeadTarget, setDeleteLeadTarget] = useState<{ id: string; name: string } | null>(null);

  // Global Context Modal State
  const [showContextModal, setShowContextModal] = useState(false);

  // Debug Modal State
  const [showDebugModal, setShowDebugModal] = useState(false);
  const [debugPromptText, setDebugPromptText] = useState('');

  // Simulated Time State

  // Editing Message State
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [extractGlobalLesson, setExtractGlobalLesson] = useState(true);

  // Lead Actions Dropdown State
  const [showLeadActions, setShowLeadActions] = useState(false);

  const contextInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchLeads = async (clientId?: string, productId?: string | null) => {
    try {
      setIsLoadingLeads(true);
      const targetClient = clientId || activeClientId;
      const targetProduct = productId !== undefined ? productId : activeProductId;
      if (!targetClient) {
        setIsLoadingLeads(false);
        return;
      }
      const data = await getLeads(targetClient, targetProduct || undefined);
      setLeads(JSON.parse(JSON.stringify(data)));
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
    if (leadDetails?.Client?.context) {
      setContextText(leadDetails.Client.context);
    } else {
      setContextText('');
    }
  }, [leadDetails]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [leadDetails?.Conversation]);

  const handleAddLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLeadName.trim() || !activeClientId) return;
    
    setIsLoading(true);
    const newId = await addLead(newLeadName, newLeadFbLink, activeClientId, activeProductId, newLeadTimezone || null);
    await fetchLeads(activeClientId);
    setActiveLeadId(newId);
    setNewLeadName('');
    setNewLeadFbLink('');
    setNewLeadTimezone('');
    setShowAddLead(false);
    setIsLoading(false);
  };

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName.trim()) return;
    setIsLoading(true);
    const res = await addClient(newClientName);
    if (res.success && res.client) {
      toast.success('Client added successfully');
      setClients(prev => [res.client, ...prev]);
      setActiveClientId(res.client.id);
      setShowAddClient(false);
      setNewClientName('');
    } else {
      toast.error(res.error || 'Failed to add client');
    }
    setIsLoading(false);
  };

  const handleGeneratePvps = async () => {
    if (!newProductName.trim()) {
      toast.error("Product name is required");
      return;
    }
    setIsGeneratingPvps(true);
    try {
      const { generatePvpsN8n } = await import('./actions');
      const activeClient = clients.find(c => c.id === activeClientId);
      const res = await generatePvpsN8n(activeClientId!, activeClient?.name || null, newProductName, newProductAbout);
      if (res.success && res.statement) {
        setNewProductPvps(res.statement);
        toast.success("PVPS generated!");
      } else {
        toast.error(res.error || "Failed to generate PVPS");
      }
    } catch (e: any) {
      toast.error(e.message || "Failed");
    } finally {
      setIsGeneratingPvps(false);
    }
  };

  const handleSaveProduct = async () => {
    if (!newProductPvps?.trim() || !activeClientId) {
      toast.error("PVPS and Client are required");
      return;
    }
    setIsSavingProduct(true);
    try {
      const { addProductBothDbs } = await import('./actions');
      const res = await addProductBothDbs(activeClientId, newProductName, newProductPvps, newProductAbout);
      if (res.success) {
        toast.success("Product added successfully!");
        setShowAddProduct(false);
        setNewProductName('');
        setNewProductAbout('');
        setNewProductPvps(null);
        await initClients();
      } else {
        toast.error(res.error || "Failed to add product");
      }
    } catch(e:any) {
      toast.error(e.message);
    } finally {
      setIsSavingProduct(false);
    }
  };

  const handleEditClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editClientName.trim() || !activeClientId) return;
    setIsLoading(true);
    const res = await editClient(activeClientId, editClientName);
    if (res.success && res.client) {
      toast.success('Client name updated');
      setClients(prev => prev.map(c => c.id === activeClientId ? res.client : c));
      setShowEditClient(false);
    } else {
      toast.error(res.error || 'Failed to edit client');
    }
    setIsLoading(false);
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

  const handleToggleNotQualified = async (lead: any) => {
    const next = lead.LeadState?.leadStatus !== 'NOT_QUALIFIED';
    await setLeadQualification(lead.id, next);
    await fetchLeads();
    if (activeLeadId === lead.id) await fetchLeadDetails(lead.id);
    toast.success(next ? `${lead.name} moved to Not qualified` : `${lead.name} marked as qualified`);
  };

  const handleEditLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editLeadName.trim() || !activeLeadId) return;
    
    setIsLoading(true);
    await editLead(activeLeadId, editLeadName, editLeadFbLink, editLeadTimezone || null);
    await fetchLeads();
    await fetchLeadDetails(activeLeadId);
    setShowEditLead(false);
    setIsLoading(false);
  };

  const confirmDeleteLead = async () => {
    const targetId = deleteLeadTarget?.id ?? activeLeadId;
    if (!targetId) return;
    setIsLoading(true);
    try {
      await removeLead(targetId);
      if (targetId === activeLeadId) {
        setActiveLeadId(null);
        setLeadDetails(null);
      }
      await fetchLeads();
      setShowDeleteLead(false);
      setDeleteLeadTarget(null);
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete lead. Check database connection.');
    }
    setIsLoading(false);
  };

  const handleContextUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      if (event.target?.result) {
        setIsSavingContext(true);
        const text = event.target.result as string;
        setContextText(prev => prev ? prev + '\n\n' + text : text);
        toast.success(`Loaded context from ${file.name}. Click Save Context to apply.`);
        setIsSavingContext(false);
      }
    };
    reader.readAsText(file);
  };

  const handleContextFileUploadR2 = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsSavingContext(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const { fileUrl, error } = await uploadFileToR2(formData);
      if (error) {
        toast.error(`Upload failed: ${error}`);
      } else if (fileUrl) {
        const publicUrl = process.env.NEXT_PUBLIC_R2_URL || 'https://aidm.xfnite.cloud';
        const finalUrl = `${publicUrl}/${fileUrl}`;
        setContextUrls(prev => [...prev, finalUrl]);
        toast.success('File uploaded to R2. Click Save Context to apply globally.');
      }
    } catch (err) {
      console.error('Upload failed', err);
      toast.error('Upload failed.');
    }
    setIsSavingContext(false);
  };

  const handleSaveContext = async () => {
    setIsSavingContext(true);
    if (activeSettingsTab === 'knowledge') {
      const finalContext = [contextText.trim(), ...contextUrls].filter(Boolean).join('\n\n');
      await saveClientContext(activeClientId, finalContext);
      await initClients(); // refresh clients to update the local state with the new context
      toast.success('Knowledge Base saved.');
    } else {
      const parsedStages = clientStagesState.map(s => {
        let config: any[] = [];
        
        // Zero-token regex extraction
        const match = s.systemPrompt.match(/STAGE ASSESSMENT:([\s\S]+?)(?:IMPORTANT:|FINAL CHECK BEFORE RESPONDING|$)/i);
        if (match) {
          const lines = match[1].trim().split('\n').map((l: string) => l.trim()).filter(Boolean);
          const ignoreKeys = ['Latest Message Sender', 'Current Stage', 'Lead Status', 'Stage Exit Criteria Met', 'Summary'];
          for (const line of lines) {
            const parts = line.split(':');
            if (parts.length >= 2) {
              const label = parts[0].trim();
              if (!ignoreKeys.includes(label)) {
                config.push({
                  id: label.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
                  type: line.includes('[Captured / Missing]') ? 'boolean' : 'string',
                  label: label
                });
              }
            }
          }
        }

        // Fallback to manual if regex found nothing
        if (config.length === 0) {
          if (typeof s.checklistConfig === 'string') {
            try {
              config = JSON.parse(s.checklistConfig || '[]');
            } catch(e) {
              console.error("Invalid JSON in stage", s.stageOrder);
            }
          } else {
            config = s.checklistConfig || [];
          }
        }
        
        return { ...s, checklistConfig: config };
      });
      const { saveClientStages } = await import('./actions');
      await saveClientStages(activeClientId!, activeProductId || null, parsedStages);
      setFunnelStages(await getClientStages(activeClientId!, activeProductId || null));
      toast.success('Funnel config saved.');
    }
    setIsSavingContext(false);
    setShowContextModal(false);
  };

  const openContextModal = async () => {
    setShowContextModal(true);
    setActiveSettingsTab('knowledge');
    try {
      const client = clients.find(c => c.id === activeClientId);
      if (client?.context) {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const urls = client.context.match(urlRegex) || [];
        const text = client.context.replace(urlRegex, '').replace(/Asset:/g, '').trim();
        setContextText(text);
        setContextUrls(urls);
      } else {
        setContextText('');
        setContextUrls([]);
      }
      
      const { getClientStages } = await import('./actions');
      const stages = await getClientStages(activeClientId!, activeProductId || null);
      setClientStagesState(stages);
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddStage = () => {
    const newStageOrder = clientStagesState.length + 1;
    setClientStagesState([...clientStagesState, {
      stageOrder: newStageOrder,
      stageName: `Stage ${newStageOrder}`,
      systemPrompt: '',
      checklistConfig: []
    }]);
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

  const handleSendMessage = async () => {
    if (!leadDetails || !inputText.trim()) return;
    
    setIsLoading(true);
    let finalPayload = inputText;

    await sendLeadMessage(leadDetails.id, finalPayload);
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
    setIsLoading(true);
    
    await editConversationMessage(editingMessageId, editingContent);
    
    if (extractGlobalLesson && msg.content !== editingContent) {
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

  // Follow-up status per lead, based on the lead's timezone (falls back to this browser's timezone)
  const followUpStatuses = useMemo(() => {
    const map = new Map<string, NonNullable<ReturnType<typeof getFollowUpStatus>>>();
    for (const lead of leads) {
      const tz = isValidTimezone(lead.timezone) ? lead.timezone : browserTimezone();
      const status = getFollowUpStatus(lead.Conversation, tz);
      if (status) map.set(lead.id, status);
    }
    return map;
  }, [leads]);

  const isNotQualified = (lead: any) => lead.LeadState?.leadStatus === 'NOT_QUALIFIED';

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
        if (isNotQualified(lead)) return false;
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
      : leads.filter(lead => !isNotQualified(lead));
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

  const timelineStages = useMemo(() => {
    const nums = new Set<number>();
    editMemoryConversations.forEach((m: any) => nums.add(m.stage ?? 1));
    return Array.from(nums).sort((a, b) => a - b);
  }, [editMemoryConversations]);

  const timelineMessages = useMemo(
    () => timelineStage === 'all' ? editMemoryConversations : editMemoryConversations.filter((m: any) => m.stage === timelineStage),
    [editMemoryConversations, timelineStage]
  );

  const confirmDeleteMessage = async () => {
    if (!deleteMsgId) return;
    setIsDeletingMsg(true);
    try {
      await editConversationMessage(deleteMsgId, '__DELETE__');
      setEditingMsgId(null);
      toast.success('Message deleted');
      await refreshTimeline();
      setDeleteMsgId(null);
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete message.');
    }
    setIsDeletingMsg(false);
  };

  const refreshTimeline = async () => {
    const data = await getLeadDetails(editMemoryLeadId);
    setEditMemoryConversations(data?.Conversation || []);
    if (activeLeadId === editMemoryLeadId) {
      setLeadDetails(JSON.parse(JSON.stringify(await getLeadDetails(activeLeadId))));
    }
  };

  const renderInsertForm = (afterMsgId: string | null) => (
    <div className="bg-secondary/40 p-3 rounded-md border border-border flex flex-col gap-2 shadow-inner">
      <div className="flex gap-2">
        <Button variant={insertRole === 'user' ? 'default' : 'outline'} size="sm" onClick={() => setInsertRole('user')} className="h-7 text-xs">Lead</Button>
        <Button variant={insertRole === 'assistant' ? 'default' : 'outline'} size="sm" onClick={() => setInsertRole('assistant')} className="h-7 text-xs">AI Draft</Button>
        {editMemoryConversations.length > 0 && (
          <Button variant={insertRole === 'stage' ? 'default' : 'outline'} size="sm" onClick={() => setInsertRole('stage')} className="h-7 text-xs">Stage Marker</Button>
        )}
      </div>
      {insertRole === 'stage' && editMemoryConversations.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <select
            value={insertStage}
            onChange={e => setInsertStage(parseInt(e.target.value, 10))}
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
          <Textarea value={insertContent} onChange={e => setInsertContent(e.target.value)} placeholder="Type new message..." className="text-sm min-h-[60px]" />
          <select
            value={insertMsgStage}
            onChange={e => setInsertMsgStage(e.target.value === 'auto' ? 'auto' : parseInt(e.target.value, 10))}
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
        <Button variant="outline" size="sm" onClick={() => { setInsertTargetMsgId(undefined); setInsertContent(''); }} className="h-7 text-xs">Cancel</Button>
        <Button size="sm" className="h-7 text-xs" onClick={async () => {
          if (insertRole === 'stage' && editMemoryConversations.length > 0) {
            const idx = afterMsgId === null ? 0 : editMemoryConversations.findIndex(m => m.id.toString() === afterMsgId) + 1;
            const next = editMemoryConversations[idx];
            if (!next) {
              toast.error('There is no message after this point to start the stage on.');
              return;
            }
            await setMessageStageFrom(editMemoryLeadId, next.id.toString(), insertStage);
            toast.success(`Stage ${insertStage} marker applied`);
          } else {
            if (!insertContent.trim()) return;
            await insertConversationMessage(editMemoryLeadId, insertRole === 'stage' ? 'user' : insertRole, insertContent, afterMsgId, insertMsgStage === 'auto' ? undefined : insertMsgStage);
            toast.success('Message inserted');
          }
          setInsertTargetMsgId(undefined);
          setInsertContent('');
          await refreshTimeline();
        }}>{insertRole === 'stage' ? 'Apply' : 'Insert'}</Button>
      </div>
    </div>
  );

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
            <DropdownMenuItem onClick={openContextModal}>
              <span className="material-symbols-sharp mr-2 text-[1.1rem] text-muted-foreground">settings</span>
              Client Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => {
              setNewClientName('');

              setShowAddClient(true);
            }}>
              <span className="material-symbols-sharp mr-2 text-[1.1rem] text-muted-foreground">add</span>
              Add New Client
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
                  <span className="material-symbols-sharp shrink-0" style={{ color: 'var(--muted)', fontSize: '2.2rem' }}>
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
                        <DropdownMenuItem onClick={async (e) => {
                          e.stopPropagation();
                          setEditMemoryLeadId(lead.id);
                          setTimelineStage('all');
                          setEditMemoryText(lead.LeadState?.leadSummary || '');
                          setEditMemoryStage(lead.LeadState?.stage || 1);
                          setEditMemoryConnection(lead.LeadState?.connectionLevel || 'LOW');
                          setEditMemoryIntent(lead.LeadState?.primary_intent_id || '');
                          setEditMemoryAssessment(lead.LeadState?.assessmentData || {});
                          setShowEditMemory(true);
                          // Load conversation history for Timeline Editor
                          setIsMemoryLoading(true);
                          const data = await getLeadDetails(lead.id);
                          setEditMemoryConversations(data?.Conversation || []);
                          setIsMemoryLoading(false);
                        }}>
                          <span className="material-symbols-sharp mr-2 text-[1.1rem]">memory</span>
                          Edit Long Term Memory
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          handleToggleNotQualified(lead);
                        }}>
                          <span className="material-symbols-sharp mr-2 text-[1.1rem]">{isNotQualified(lead) ? 'how_to_reg' : 'person_off'}</span>
                          {isNotQualified(lead) ? 'Mark as qualified' : 'Mark as not qualified'}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteLeadTarget({ id: lead.id, name: lead.name });
                            setTimeout(() => setShowDeleteLead(true), 10);
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
                    onClick={() => {
                      setEditLeadName(leadDetails.name);
                      setEditLeadFbLink(leadDetails.fb_link || '');
                      setEditLeadTimezone(leadDetails.timezone || '');
                      setTimeout(() => setShowEditLead(true), 10);
                    }}
                  >
                    <span className="material-symbols-sharp text-[1.3rem]">edit</span>
                  </Button>

                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="w-9 h-9 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-md"
                    title="Edit Long Term Memory"
                    onClick={async () => {
                      setEditMemoryLeadId(leadDetails.id);
                      setTimelineStage('all');
                      setEditMemoryText(leadDetails.LeadState?.leadSummary || '');
                      setEditMemoryStage(leadDetails.LeadState?.stage || 1);
                      setEditMemoryConnection(leadDetails.LeadState?.connectionLevel || 'LOW');
                      setEditMemoryIntent(leadDetails.LeadState?.primary_intent_id || '');
                      setEditMemoryAssessment(leadDetails.LeadState?.assessmentData || {});
                      setShowEditMemory(true);
                      setIsMemoryLoading(true);
                      const data = await getLeadDetails(leadDetails.id);
                      setEditMemoryConversations(data?.Conversation || []);
                      setIsMemoryLoading(false);
                    }}
                  >
                    <span className="material-symbols-sharp text-[1.3rem]">memory</span>
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
                    onClick={() => {
                      setDeleteLeadTarget({ id: leadDetails.id, name: leadDetails.name });
                      setTimeout(() => setShowDeleteLead(true), 10);
                    }}
                  >
                    <span className="material-symbols-sharp text-[1.3rem]">delete</span>
                  </Button>
                </div>
              </div>
              <Sheet open={showMobileDetails} onOpenChange={setShowMobileDetails}>
                <SheetContent side="right" className="w-[85vw] sm:w-[400px] overflow-y-auto bg-card p-0 flex flex-col h-full border-l border-border">
                  <RightSidebarContent 
                    activeLeadId={activeLeadId}
                    leadDetails={leadDetails}
                    activeStageConfig={activeStageConfig}
                    handleShowDebugPrompt={handleShowDebugPrompt}
                    setEditLeadName={setEditLeadName}
                    setEditLeadFbLink={setEditLeadFbLink}
          setEditLeadTimezone={setEditLeadTimezone}
                    setShowEditLead={setShowEditLead}
                    setShowDeleteLead={setShowDeleteLead}
                  />
                </SheetContent>
              </Sheet>
            </header>
            
            {/* Stage Tabs */}
            {chatStages.length > 1 && (
              <div className="shrink-0 flex items-center gap-2 px-6 py-2 border-b border-border bg-card overflow-x-auto [scrollbar-width:none]">
                {(['all', ...chatStages] as (number | 'all')[]).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveChatStage(tab)}
                    className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap border transition-colors ${activeChatStage === tab ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-border hover:text-foreground'}`}
                  >
                    {tab === 'all' ? 'All' : stageLabel(tab)}
                    {tab === leadDetails?.LeadState?.stage ? ' •' : ''}
                  </button>
                ))}
              </div>
            )}

            {/* Scrollable Message History */}
            <div className="flex-1 overflow-y-auto min-h-0 p-6 flex flex-col gap-6 bg-background">
              {(!leadDetails.Conversation || leadDetails.Conversation.length === 0) ? (
                <div className="m-auto text-muted-foreground text-center flex flex-col items-center gap-2">
                  <span className="material-symbols-sharp text-4xl opacity-50">chat_bubble</span>
                  <p>No messages yet. Send a message to start the funnel.</p>
                </div>
              ) : (
                visibleMessages.map((msg: any) => (
                  <div key={msg.id.toString()} className={`flex flex-col max-w-[90%] md:max-w-[75%] ${msg.role === 'user' ? 'self-end items-end' : 'self-start items-start'}`}>
                    
                    {/* Header */}
                    <div className={`flex items-center gap-3 mb-1.5 px-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                       <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                         {msg.role === 'user' ? 'Lead' : 'AI Draft'}
                       </span>
                       <span 
                         className="text-[10px] text-muted-foreground/70 cursor-default"
                         title={msg.createdAt ? new Date(msg.createdAt).toLocaleString() : ''}
                       >
                         {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : ''}
                       </span>
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
                          <button onClick={() => {
                            setEditMemoryLeadId(activeLeadId as string);
                            setDeleteMsgId(msg.id.toString());
                          }} className="text-muted-foreground hover:text-destructive transition-colors" title="Delete">
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
                ))
              )}
              {isLoading && (
                <div className="flex flex-col self-start max-w-[90%] md:max-w-[75%] items-start">
                   {/* Header */}
                   <div className="flex items-center gap-3 mb-1.5 px-2 flex-row">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                        AI Draft
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
                      !(hasDraftReady(leadDetails) || ((followUpStatuses.get(leadDetails.id)?.dueAt ?? Infinity) <= nowMs))
                    }
                    title={
                      (!leadDetails || isNotQualified(leadDetails) || !(hasDraftReady(leadDetails) || ((followUpStatuses.get(leadDetails.id)?.dueAt ?? Infinity) <= nowMs)))
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
        <RightSidebarContent 
          activeLeadId={activeLeadId}
          leadDetails={leadDetails}
          activeStageConfig={activeStageConfig}
          handleShowDebugPrompt={handleShowDebugPrompt}
          setEditLeadName={setEditLeadName}
          setEditLeadFbLink={setEditLeadFbLink}
          setEditLeadTimezone={setEditLeadTimezone}
          setShowEditLead={setShowEditLead}
          setShowDeleteLead={setShowDeleteLead}
        />
      </aside>
      </div>

      {/* Add Lead Modal */}
      <Dialog open={showAddLead} onOpenChange={setShowAddLead}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="material-symbols-sharp">person_add</span>
              Add New Lead
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddLead} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="leadName">Lead Name</Label>
              <Input 
                id="leadName"
                value={newLeadName}
                onChange={(e) => setNewLeadName(e.target.value)}
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
                value={newLeadFbLink}
                onChange={(e) => setNewLeadFbLink(e.target.value)}
                placeholder="https://facebook.com/..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="leadTimezone">Lead Timezone (Optional)</Label>
              <TimezoneSelect id="leadTimezone" value={newLeadTimezone} onChange={setNewLeadTimezone} />
              <p className="text-xs text-muted-foreground">Follow-up reminders are scheduled in the lead's local time.</p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowAddLead(false)} disabled={isLoading}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading || !newLeadName.trim()}>
                {isLoading ? 'Adding...' : 'Add Lead'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Lead Modal */}
      <Dialog open={showEditMemory} onOpenChange={setShowEditMemory}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="material-symbols-sharp text-primary">memory</span>
              Edit Long Term Memory
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="memory">Memory Summary</Label>
              <Textarea
                id="memory"
                value={editMemoryText}
                onChange={(e) => setEditMemoryText(e.target.value)}
                placeholder="Enter long term memory / summary..."
                className="min-h-[150px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditMemory(false)}>Cancel</Button>
            <Button onClick={async () => {
              const res = await editLeadMemory(editMemoryLeadId, editMemoryText);
              // Optimistically update the active lead details if it's currently selected
              if (activeLeadId === editMemoryLeadId) {
                setLeadDetails((prev: any) => ({
                  ...prev,
                  LeadState: {
                    ...prev.LeadState,
                    leadSummary: editMemoryText
                  }
                }));
              }
              setShowEditMemory(false);
              toast.success("Long term memory updated");
            }}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Structured Memory Modal */}
      <Dialog open={showEditMemory} onOpenChange={setShowEditMemory}>
        <DialogContent className="w-[90vw] sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="material-symbols-sharp text-primary">history_edu</span>
              Timeline Editor
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            {isMemoryLoading ? (
              <div className="text-sm text-muted-foreground animate-pulse py-8 text-center">Loading conversation history...</div>
            ) : editMemoryConversations.length === 0 ? (
              <div className="flex flex-col gap-3 py-4">
                <div className="text-sm text-muted-foreground text-center">No messages yet. Add earlier conversation history below.</div>
                {renderInsertForm(null)}
              </div>
            ) : (
              <div className="space-y-2 max-h-[65vh] overflow-y-auto pr-2 custom-scrollbar">
                {timelineStages.length > 1 && (
                  <div className="sticky top-0 z-20 flex items-center gap-2 py-2 bg-card overflow-x-auto [scrollbar-width:none]">
                    {(['all', ...timelineStages] as (number | 'all')[]).map(tab => (
                      <button
                        key={tab}
                        onClick={() => setTimelineStage(tab)}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${timelineStage === tab ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'}`}
                      >
                        Stage {tab}
                      </button>
                    ))}
                  </div>
                )}

                {/* Insert at top */}
                <div className="flex justify-center py-1 opacity-0 hover:opacity-100 transition-opacity z-10 relative">
                  <Button size="sm" variant="outline" className="h-6 rounded-full text-xs bg-background border-border shadow-sm" onClick={() => setInsertTargetMsgId(null)}>
                    <span className="material-symbols-sharp text-[1rem]">add</span>
                  </Button>
                </div>

                {insertTargetMsgId === null && renderInsertForm(null)}

                  {timelineMessages.map((msg: any, idx: number) => (
                    <React.Fragment key={msg.id.toString()}>
                      {(idx === 0 || timelineMessages[idx - 1].stage !== msg.stage) && (
                        <div className="flex items-center gap-4 py-4">
                          <div className="flex-1 h-[1px] bg-border"></div>
                          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-background px-3 border border-border rounded-full shadow-sm">
                            {stageLabel(msg.stage)} Started Here
                          </span>
                          <div className="flex-1 h-[1px] bg-border"></div>
                        </div>
                      )}
                      {(() => {
                        
                        return (
                          <div
                            className={`flex items-start gap-3 p-3 rounded-md border shadow-sm group transition-colors ${editingMsgId === msg.id.toString() ? 'bg-primary/5 border-primary/30' : 'bg-card border-border hover:border-primary/20 hover:bg-card/80'}`}
                          >
                            <DropdownMenu>
                              <DropdownMenuTrigger className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase shrink-0 mt-0.5 tracking-wider cursor-pointer hover:opacity-80 transition-opacity outline-none ${msg.role === 'user' ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`} title="Change role">
                                {msg.role === 'user' ? 'Lead' : 'AI'}
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start">
                                {(['assistant', 'user'] as const).map(r => (
                                  <DropdownMenuItem key={r} disabled={msg.role === r} onClick={async () => {
                                    await editConversationMessage(msg.id.toString(), msg.content, r);
                                    toast.success(`Role updated to ${r === 'user' ? 'Lead' : 'AI'}`);
                                    const data = await getLeadDetails(editMemoryLeadId);
                                    setEditMemoryConversations(data?.Conversation || []);
                                    if (activeLeadId === editMemoryLeadId) {
                                      const activeData = await getLeadDetails(activeLeadId);
                                      setLeadDetails(JSON.parse(JSON.stringify(activeData)));
                                    }
                                  }}>
                                    {r === 'user' ? 'Lead (user)' : 'AI (assistant)'}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                            <div className="text-sm flex-1 flex flex-col group/msg">
                              <Textarea 
                                value={msg.content} 
                                onChange={e => {
                                  const newConvos = [...editMemoryConversations];
                                  const cIdx = newConvos.findIndex(m => m.id === msg.id);
                                  if (cIdx >= 0) {
                                    if (newConvos[cIdx]._originalContent === undefined) {
                                      newConvos[cIdx]._originalContent = newConvos[cIdx].content;
                                    }
                                    newConvos[cIdx].content = e.target.value;
                                    newConvos[cIdx]._isDirty = newConvos[cIdx].content !== newConvos[cIdx]._originalContent;
                                    setEditMemoryConversations(newConvos);
                                  }
                                }} 
                                className="text-sm min-h-[60px] bg-transparent border-transparent hover:border-input focus:border-input resize-y shadow-none focus-visible:ring-1 focus-visible:bg-background transition-all -ml-2 w-[calc(100%+1rem)]" 
                              />
                              <div className={`flex justify-end gap-1.5 mt-1 transition-opacity ${msg._isDirty ? 'opacity-100' : 'opacity-0 group-hover/msg:opacity-100'}`}>
                                {msg._isDirty && (
                                  <Button variant="secondary" size="sm" className="h-7 text-xs shadow-none border border-border/50" onClick={async (e) => {
                                    e.stopPropagation();
                                    if (!msg.content.trim()) return;
                                    await editConversationMessage(msg.id.toString(), msg.content);
                                    toast.success('Message saved');
                                    const data = await getLeadDetails(editMemoryLeadId);
                                    setEditMemoryConversations(data?.Conversation || []);
                                    if (activeLeadId === editMemoryLeadId) {
                                      const activeData = await getLeadDetails(activeLeadId);
                                      setLeadDetails(JSON.parse(JSON.stringify(activeData)));
                                    }
                                  }}>
                                    <span className="material-symbols-sharp text-[1.1rem] mr-1">save</span>Save
                                  </Button>
                                )}
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={(e) => {
                                  e.stopPropagation();
                                  setEditMemoryLeadId(activeLeadId as string);
                                  setDeleteMsgId(msg.id.toString());
                                }} title="Delete message">
                                  <span className="material-symbols-sharp text-[1.1rem]">delete</span>
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                    {/* Insert after msg */}
                    <div className="flex justify-center py-1 opacity-0 hover:opacity-100 transition-opacity z-10 relative">
                      <Button size="sm" variant="outline" className="h-6 rounded-full text-xs bg-background border-border shadow-sm" onClick={() => setInsertTargetMsgId(msg.id.toString())}>
                        <span className="material-symbols-sharp text-[1rem]">add</span>
                      </Button>
                    </div>

                    {insertTargetMsgId === msg.id.toString() && renderInsertForm(msg.id.toString())}
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>
          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setShowEditMemory(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>



      <Dialog open={showEditLead} onOpenChange={setShowEditLead}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="material-symbols-sharp">edit</span>
              Edit Lead
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditLead} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="editLeadName">Lead Name</Label>
              <Input 
                id="editLeadName"
                value={editLeadName}
                onChange={(e) => setEditLeadName(e.target.value)}
                placeholder="e.g. Dr. Jane Smith"
                required
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editLeadFb">Facebook Profile URL (Optional)</Label>
              <Input 
                id="editLeadFb"
                type="url" 
                value={editLeadFbLink}
                onChange={(e) => setEditLeadFbLink(e.target.value)}
                placeholder="https://facebook.com/..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editLeadTimezone">Lead Timezone (Optional)</Label>
              <TimezoneSelect id="editLeadTimezone" value={editLeadTimezone} onChange={setEditLeadTimezone} />
              <p className="text-xs text-muted-foreground">Follow-up reminders are scheduled in the lead's local time.</p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowEditLead(false)} disabled={isLoading}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading || !editLeadName.trim()}>
                {isLoading ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Message Modal */}
      <Dialog open={deleteMsgId !== null} onOpenChange={(open) => { if (!open) setDeleteMsgId(null); }}>
        <DialogContent className="sm:max-w-md border-destructive/20">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <span className="material-symbols-sharp">warning</span>
              Delete Message
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-2">
            <p className="text-sm text-foreground">Are you sure you want to delete this message?</p>
            <p className="text-sm text-muted-foreground">This action cannot be undone.</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteMsgId(null)} disabled={isDeletingMsg}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={confirmDeleteMessage} disabled={isDeletingMsg}>
              {isDeletingMsg ? 'Deleting...' : 'Delete Message'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Lead Modal */}
      <Dialog open={showDeleteLead} onOpenChange={(open) => { setShowDeleteLead(open); if (!open) setDeleteLeadTarget(null); }}>
        <DialogContent className="sm:max-w-md border-destructive/20">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <span className="material-symbols-sharp">warning</span>
              Delete Lead
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-sm text-foreground">
              Are you sure you want to delete <strong>{deleteLeadTarget?.name ?? leadDetails?.name}</strong>?
            </p>
            <p className="text-sm text-muted-foreground">
              All chat history, state, and context for this lead will be permanently deleted. This action cannot be undone.
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { setShowDeleteLead(false); setDeleteLeadTarget(null); }} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={confirmDeleteLead} disabled={isLoading}>
              {isLoading ? 'Deleting...' : 'Delete Lead'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Client Settings Modal */}
      <Dialog open={showContextModal} onOpenChange={setShowContextModal}>
        <DialogContent className="w-[95vw] sm:max-w-4xl max-h-[90vh] overflow-y-auto overflow-x-hidden p-4 sm:p-6">
          <DialogHeader className="border-b border-border pb-4 mb-4">
            <DialogTitle className="flex justify-between items-center text-xl">
              <div className="flex items-center gap-2">
                <span className="material-symbols-sharp text-primary">settings_applications</span>
                Client Configuration
              </div>
            </DialogTitle>
            <DialogDescription className="text-sm pt-2">
              Configure the AI's global knowledge base and its stage-by-stage sales funnel for this client.
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-6 border-b border-border mb-6">
            <button 
              className={`pb-3 px-2 border-b-2 font-semibold text-sm transition-colors flex items-center gap-2 ${activeSettingsTab === 'knowledge' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
              onClick={() => setActiveSettingsTab('knowledge')}
            >
              <span className="material-symbols-sharp text-[1.2rem]">menu_book</span>
              Global Knowledge Base
            </button>
            <button 
              className={`pb-3 px-2 border-b-2 font-semibold text-sm transition-colors flex items-center gap-2 ${activeSettingsTab === 'funnel' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
              onClick={() => setActiveSettingsTab('funnel')}
            >
              <span className="material-symbols-sharp text-[1.2rem]">account_tree</span>
              Funnel Stages & Prompts
            </button>
          </div>

          {activeSettingsTab === 'knowledge' ? (
            <div className="flex flex-col">
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Additional Context Files (Optional)</h4>
                <Button type="button" variant="secondary" size="sm" onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.onchange = (e) => handleContextFileUploadR2(e as unknown as React.ChangeEvent<HTMLInputElement>);
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

              {(() => {
                const currentClient = clients.find(c => c.id === activeClientId);
                if (!currentClient) return null;
                return (
                  <div className="mb-6 p-4 rounded-md border border-primary/20 bg-primary/5">
                    <h4 className="text-sm font-semibold mb-3 text-primary uppercase tracking-wider flex items-center gap-2">
                      <span className="material-symbols-sharp text-[1.1rem]">apartment</span>
                      Client PVPs
                    </h4>
                    <div className="text-sm space-y-3 text-foreground">
                      <div>
                        <strong className="text-muted-foreground block text-xs mb-1">Value Proposition (VPS)</strong>
                        <p className="whitespace-pre-wrap text-[13px]">{currentClient.vps || 'None provided. Use "Sync Clients from Tools" to pull it in.'}</p>
                      </div>
                      <div>
                        <strong className="text-muted-foreground block text-xs mb-1">Target Persona</strong>
                        <p className="whitespace-pre-wrap text-[13px]">{currentClient.persona || 'None provided'}</p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-3 italic border-t border-primary/10 pt-2">
                      This information is automatically injected into the AI's prompt for all of this client's leads, global or product.
                    </p>
                  </div>
                );
              })()}

              {(() => {
                const currentClient = clients.find(c => c.id === activeClientId);
                const currentProduct = currentClient?.Product?.find((p:any) => p.id === activeProductId);
                if (!currentProduct) return null;
                
                return (
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
                      This information is automatically injected into the AI's prompt when generating drafts for this product's leads.
                    </p>
                  </div>
                );
              })()}

              {(() => {
                if (!activeProductId) {
                  return (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground bg-secondary/10 rounded-lg border border-border border-dashed">
                      <span className="material-symbols-sharp text-4xl mb-3 opacity-50">inventory_2</span>
                      <p className="text-sm">Select a specific product from the client dropdown to view its PVPs here.</p>
                    </div>
                  );
                }
                return null;
              })()}
            </div>
          ) : (
             <div className="space-y-6">
               <div className="flex justify-between items-center">
                 <p className="text-sm text-muted-foreground">Define custom stages and the AI instruction for each stage.</p>
                 <Button onClick={() => {
                   handleAddStage();
                   setActiveStageIndex(clientStagesState.length);
                 }} size="sm"><span className="material-symbols-sharp mr-1">add</span> Add Stage</Button>
               </div>
               
               <div className="flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                 {clientStagesState.map((stage, idx) => (
                   <button
                     key={idx}
                     onClick={() => setActiveStageIndex(idx)}
                     className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${activeStageIndex === idx ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'}`}
                   >
                     Stage {stage.stageOrder}
                   </button>
                 ))}
               </div>

               {clientStagesState.length > 0 && clientStagesState[activeStageIndex] && (() => {
                 const stage = clientStagesState[activeStageIndex];
                 const idx = activeStageIndex;
                 return (
                   <div key={idx} className="border border-border rounded-md p-4 bg-secondary/20 relative group">
                     <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-4">
                       <span className="font-bold shrink-0">Stage {stage.stageOrder}</span>
                       <Input 
                         value={stage.stageName} 
                         onChange={(e) => {
                           const copy = [...clientStagesState];
                           copy[idx].stageName = e.target.value;
                           setClientStagesState(copy);
                         }}
                         placeholder="Stage Name"
                         className="w-full sm:max-w-[300px]"
                       />
                       <Button variant="ghost" size="icon" className="text-destructive sm:ml-auto opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity self-end sm:self-auto shrink-0" onClick={() => {
                         const copy = clientStagesState.filter((_, i) => i !== idx);
                         copy.forEach((s, i) => s.stageOrder = i + 1);
                         setClientStagesState(copy);
                         setActiveStageIndex(Math.max(0, idx - 1));
                       }}><span className="material-symbols-sharp">delete</span></Button>
                     </div>
                     
                     <Label className="mb-2 block text-sm font-medium">System Prompt</Label>
                     <Textarea 
                       value={stage.systemPrompt}
                       onChange={(e) => {
                         const copy = [...clientStagesState];
                         copy[idx].systemPrompt = e.target.value;
                         setClientStagesState(copy);
                       }}
                       className="min-h-[250px] font-mono text-xs mb-4 resize-y bg-background"
                       placeholder="You are an AI assistant..."
                     />
                   </div>
                 );
               })()}
             </div>
          )}
          
          <DialogFooter className="mt-4 pt-4 border-t border-border">
            <Button type="button" variant="outline" onClick={() => setShowContextModal(false)} disabled={isSavingContext}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSaveContext} disabled={isSavingContext}>
              {isSavingContext ? 'Saving...' : 'Save Settings'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Debug Logs Modal */}
      <Dialog open={showDebugModal} onOpenChange={setShowDebugModal}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary">
              <span className="material-symbols-sharp">bug_report</span>
              Active Prompt (Stage {leadDetails?.LeadState?.stage})
            </DialogTitle>
            <DialogDescription>
              This is exactly what the AI receives for its next draft: the stage prompt, lead profile, product PVPS, global client context, attached files and chat history.
            </DialogDescription>
          </DialogHeader>

          <div className="bg-secondary text-foreground p-4 rounded-md overflow-y-auto max-h-[500px] text-sm font-mono whitespace-pre-wrap border border-border shadow-inner mt-4">
            {debugPromptText}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Product Modal */}
      <Dialog open={showAddProduct} onOpenChange={(open) => {
        if (!open && (isGeneratingPvps || isSavingProduct)) return;
        setShowAddProduct(open);
        if (!open) {
          setNewProductName('');
          setNewProductAbout('');
          setNewProductPvps(null);
        }
      }}>
        <DialogContent className="sm:max-w-lg bg-card">
          <DialogHeader>
            <DialogTitle>Add Product</DialogTitle>
            <DialogDescription>Register a new product or service for a client.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Client <span className="text-red-500">*</span></Label>
              <div className="relative">
                <Input
                  value={clients.find(c => c.id === activeClientId)?.name || ''}
                  disabled
                  className="bg-background cursor-not-allowed text-foreground"
                />
                <span className="material-symbols-sharp absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-lg pointer-events-none">expand_more</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Product Name <span className="text-red-500">*</span></Label>
              <Input
                value={newProductName}
                onChange={(e) => setNewProductName(e.target.value)}
                placeholder="e.g. Social Reel Accelerator"
                className="bg-background"
                disabled={isGeneratingPvps || isSavingProduct}
              />
            </div>
            <div className="space-y-2">
              <Label>About the Product</Label>
              <Textarea
                value={newProductAbout}
                onChange={(e) => setNewProductAbout(e.target.value)}
                rows={4}
                placeholder="Short description of the product, its offer, and target audience..."
                className="bg-background resize-none"
                disabled={isGeneratingPvps || isSavingProduct}
              />
            </div>
            {newProductPvps === null ? (
              <Button 
                className="w-full h-12 flex items-center justify-center gap-2 bg-gradient-to-r from-[#9d4edd] to-[#ff006e] hover:from-[#7b2cbf] hover:to-[#ff0a54] text-white font-medium border-0 transition-all shadow-md" 
                onClick={handleGeneratePvps} 
                disabled={isGeneratingPvps || !newProductName.trim()}
              >
                {isGeneratingPvps ? "Generating PVPS..." : (
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
                    value={newProductPvps}
                    onChange={(e) => setNewProductPvps(e.target.value)}
                    rows={4}
                    className="bg-background resize-none"
                    disabled={isGeneratingPvps || isSavingProduct}
                  />
                </div>
                <div className="flex gap-3 mt-4">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={handleGeneratePvps}
                    disabled={isGeneratingPvps || isSavingProduct}
                  >
                    Retry
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={handleSaveProduct}
                    disabled={isGeneratingPvps || isSavingProduct || !newProductPvps.trim()}
                  >
                    {isSavingProduct ? "Saving..." : "Save"}
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Client Modal */}
      <Dialog open={showAddClient} onOpenChange={setShowAddClient}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add New Client</DialogTitle>
            <DialogDescription>
              Create a new client context. Leads will be strictly tied to this client.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddClient} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="clientName">Client Name *</Label>
              <Input
                id="clientName"
                value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)}
                placeholder="e.g. Alpha Coach"
                required
                className="bg-background"
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowAddClient(false)} disabled={isLoading}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Creating...' : 'Create Client'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Client Modal */}
      <Dialog open={showEditClient} onOpenChange={setShowEditClient}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Client Name</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditClient} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="editClientName">Client Name *</Label>
              <Input
                id="editClientName"
                value={editClientName}
                onChange={(e) => setEditClientName(e.target.value)}
                placeholder="e.g. Alpha Coach"
                required
                className="bg-background"
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowEditClient(false)} disabled={isLoading}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading || !editClientName.trim()}>
                {isLoading ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

