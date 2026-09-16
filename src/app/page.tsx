'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import { getLeads, editLeadMemory, editStructuredLeadMemory, insertConversationMessage, getLeadDetails, generateDraftResponse, addLead, getPresignedUrl, sendLeadMessage, saveClientContext, uploadFileToR2, getGlobalClient, getPromptForStage, editLead, removeLead, editConversationMessage, learnFromCorrection, deleteMessage, getClients, addClient, getClientStage, editClient, getClientStages, saveClientStages, syncVipscaleClients } from './actions';
import { Button } from "@/components/ui/button";
import Loader from "@/components/ui/loader";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent,  DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent
} from "@/components/ui/dropdown-menu";

const RightSidebarContent = ({ activeLeadId, leadDetails, activeStageConfig, handleShowDebugPrompt, setEditLeadName, setEditLeadFbLink, setShowEditLead, setShowDeleteLead }: any) => {
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

      {/* Lead Actions Bottom Menu */}
      {leadDetails && (
        <div className="p-4 border-t border-border bg-card relative mt-auto shrink-0">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-muted-foreground">Lead Settings</span>
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex shrink-0 items-center justify-center rounded-full hover:bg-muted text-muted-foreground transition-colors h-8 w-8 outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <span className="material-symbols-sharp">more_vert</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={(e) => {
                  e.preventDefault();
                  setEditLeadName(leadDetails.name);
                  setEditLeadFbLink(leadDetails.fb_link || '');
                  setTimeout(() => setShowEditLead(true), 10);
                }}>
                  <span className="material-symbols-sharp mr-2 text-[1.1rem]">edit</span>
                  Edit Lead
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => {
                  e.preventDefault();
                  setTimeout(() => setShowDeleteLead(true), 10);
                }} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                  <span className="material-symbols-sharp mr-2 text-[1.1rem]">delete</span>
                  Delete Lead
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      )}
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
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editingMsgContent, setEditingMsgContent] = useState('');
  
  const [activeSettingsTab, setActiveSettingsTab] = useState<'knowledge' | 'funnel'>('knowledge');
  const [clientStagesState, setClientStagesState] = useState<any[]>([]);
  const [activeStageIndex, setActiveStageIndex] = useState(0);
  
  // Add Lead Modal State
  const [showAddLead, setShowAddLead] = useState(false);
  const [newLeadName, setNewLeadName] = useState('');
  const [newLeadFbLink, setNewLeadFbLink] = useState('');

  // Add Client Modal State
  const [showAddClient, setShowAddClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  
  const [showEditClient, setShowEditClient] = useState(false);
  const [editClientName, setEditClientName] = useState('');

  // Edit Lead Modal State
  const [showEditLead, setShowEditLead] = useState(false);
  const [editLeadName, setEditLeadName] = useState('');
  const [editLeadFbLink, setEditLeadFbLink] = useState('');

  // Delete Lead Modal State
  const [showDeleteLead, setShowDeleteLead] = useState(false);

  // Global Context Modal State
  const [showContextModal, setShowContextModal] = useState(false);

  // Debug Modal State
  const [showDebugModal, setShowDebugModal] = useState(false);
  const [debugPromptText, setDebugPromptText] = useState('');

  // Simulated Time State
  const [simulatedTime, setSimulatedTime] = useState<string>('');

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
      setLeadDetails(JSON.parse(JSON.stringify(data)));
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
    if (activeLeadId) {
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
    const newId = await addLead(newLeadName, newLeadFbLink, activeClientId);
    await fetchLeads(activeClientId);
    setActiveLeadId(newId);
    setNewLeadName('');
    setNewLeadFbLink('');
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

  const handleEditLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editLeadName.trim() || !activeLeadId) return;
    
    setIsLoading(true);
    await editLead(activeLeadId, editLeadName, editLeadFbLink);
    await fetchLeads();
    await fetchLeadDetails(activeLeadId);
    setShowEditLead(false);
    setIsLoading(false);
  };

  const confirmDeleteLead = async () => {
    if (!activeLeadId) return;
    setIsLoading(true);
    try {
      await removeLead(activeLeadId);
      setActiveLeadId(null);
      setLeadDetails(null);
      await fetchLeads();
      setShowDeleteLead(false);
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
      await saveClientStages(activeClientId!, parsedStages);
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
      const stages = await getClientStages(activeClientId!);
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
      const promptText = await getPromptForStage(leadDetails.LeadState.stage, activeClientId!);
      setDebugPromptText(promptText);
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
    
    const simTimeIso = simulatedTime ? new Date(simulatedTime).toISOString() : undefined;
    const res = await generateDraftResponse(leadDetails.id, leadDetails.client_id, simTimeIso);
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
    
    const simTimeIso = simulatedTime ? new Date(simulatedTime).toISOString() : undefined;
    const res = await generateDraftResponse(leadDetails.id, leadDetails.client_id, simTimeIso);
    
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
    const simTimeIso = simulatedTime ? new Date(simulatedTime).toISOString() : new Date().toISOString();
    const res = await generateDraftResponse(leadDetails.id, leadDetails.client_id, simTimeIso);
    
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

      const simTimeIso = simulatedTime ? new Date(simulatedTime).toISOString() : undefined;
      const res = await generateDraftResponse(leadDetails.id, leadDetails.client_id, simTimeIso);
      if (!res.success) {
        toast.error(`Draft generation failed: ${res.error}`);
      }
    }

    await fetchLeadDetails(activeLeadId as string);
    setIsLoading(false);
  };

  const filteredLeads = useMemo(() => {
    if (!searchQuery) return leads;
    const lowerQuery = searchQuery.toLowerCase();
    return leads.filter(lead => 
      (lead.name || '').toLowerCase().includes(lowerQuery) || 
      (lead.fb_link || '').toLowerCase().includes(lowerQuery)
    );
  }, [leads, searchQuery]);

  const filteredClients = useMemo(() => {
    if (!clientSearchQuery) return clients;
    const lowerQuery = clientSearchQuery.toLowerCase();
    return clients.filter(c => (c.name || '').toLowerCase().includes(lowerQuery));
  }, [clients, clientSearchQuery]);

  return (
    <div className="flex flex-col md:grid h-screen md:grid-cols-[250px_1fr] lg:grid-cols-[280px_1fr_350px] overflow-hidden">
      {/* Sidebar - Leads List */}
      <aside className={`flex flex-col h-full bg-card border-r border-border ${activeLeadId ? 'hidden md:flex' : 'flex'}`} >
        <div className="p-6 border-b border-border pb-4">
          <h2 className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 font-bold tracking-tight">
              <span className="material-symbols-sharp text-primary">smart_toy</span>
              DM Agent
            </div>
          </h2>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <span className="material-symbols-sharp absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-[1.2rem]">search</span>
              <Input 
                type="text" 
                placeholder="Search Leads..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-background"
              />
            </div>
            <Button variant="default" size="icon" onClick={() => setShowAddLead(true)} disabled={isLoading} title="Add Lead">
              <span className="material-symbols-sharp text-[1.2rem]">add</span>
            </Button>
          </div>
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
                  className={`flex items-center gap-3 p-4 border-b border-border cursor-pointer transition-colors hover:bg-surface-hover group ${activeLeadId === lead.id ? "bg-surface-hover" : ""}`}
                  onClick={() => {
                    if (activeLeadId !== lead.id) {
                      setActiveLeadId(lead.id);
                      setLeadDetails(null);
                    }
                  }}
                >
                  <span className="material-symbols-sharp" style={{ color: 'var(--muted)', fontSize: '2rem' }}>
                    account_circle
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <strong style={{ display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {lead.name}
                    </strong>
                    {lead.fb_link && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--primary)', marginTop: '2px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {lead.fb_link}
                      </div>
                    )}
                  </div>
                  <div onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger className="h-8 w-8 inline-flex items-center justify-center rounded-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted text-muted-foreground outline-none">
                        <span className="material-symbols-sharp text-[1.2rem]">more_horiz</span>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-[14rem]">
                        <DropdownMenuItem onClick={async (e) => {
                          e.stopPropagation();
                          setEditMemoryLeadId(lead.id);
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

        {/* Client Switcher Bottom Menu */}
        <div className="p-4 border-t border-border bg-card">
          <DropdownMenu>
            <DropdownMenuTrigger className="w-full flex items-center justify-between gap-2 px-3 py-3 rounded-lg border border-border bg-card hover:bg-secondary text-card-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <div className="flex items-center gap-3 overflow-hidden text-left">
                <div className="flex items-center justify-center w-8 h-8 rounded bg-primary/20 text-primary shrink-0">
                  <span className="material-symbols-sharp text-[1.2rem]">apartment</span>
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Active Client</span>
                  <span className="font-medium truncate text-sm">
                    {clients.find(c => c.id === activeClientId)?.name || 'Loading...'}
                  </span>
                  {activeProductId && (
                    <span className="text-xs text-muted-foreground truncate">
                      {clients.find(c => c.id === activeClientId)?.Product?.find((p:any) => p.id === activeProductId)?.product_name}
                    </span>
                  )}
                </div>
              </div>
              <span className="material-symbols-sharp text-muted-foreground">unfold_more</span>
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
                
                if (hasProducts) {
                  return (
                    <DropdownMenuSub key={client.id}>
                      <DropdownMenuSubTrigger className={`flex items-center justify-between ${isActiveClient ? 'bg-primary/10 text-primary font-medium' : ''}`}>
                        <span>{client.name}</span>
                        {isActiveClient && <span className="material-symbols-sharp text-primary text-[1.1rem]">check</span>}
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent>
                        <DropdownMenuItem onClick={() => { setActiveClientId(client.id); setActiveProductId(null); }} className="flex justify-between font-semibold">
                          <span>Global Leads (No Product)</span>
                          {isActiveClient && activeProductId === null && <span className="material-symbols-sharp text-primary text-[1.1rem] ml-2">check</span>}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {client.Product.map((prod: any) => (
                          <DropdownMenuItem key={prod.id} onClick={() => { setActiveClientId(client.id); setActiveProductId(prod.id); }} className="flex justify-between">
                            <span>{prod.product_name}</span>
                            {isActiveClient && activeProductId === prod.id && <span className="material-symbols-sharp text-primary text-[1.1rem] ml-2">check</span>}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  );
                }

                return (
                  <DropdownMenuItem key={client.id} onClick={() => { setActiveClientId(client.id); setActiveProductId(null); }} className={`flex items-center justify-between ${isActiveClient ? 'bg-primary/10 text-primary font-medium' : ''}`}>
                    <span>{client.name}</span>
                    {isActiveClient && <span className="material-symbols-sharp text-primary text-[1.1rem]">check</span>}
                  </DropdownMenuItem>
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
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Main Workspace Area (Chat Interface) */}
      <main className={`flex flex-col h-screen overflow-hidden bg-background ${!activeLeadId ? 'hidden md:flex' : 'flex w-full'}`}>
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
              
              <Button variant="outline" size="sm" className="lg:hidden ml-auto" onClick={() => setShowMobileDetails(true)}>
                <span className="material-symbols-sharp mr-2 text-[1.2rem]">info</span>
                Info
              </Button>
              
              <Sheet open={showMobileDetails} onOpenChange={setShowMobileDetails}>
                <SheetContent side="right" className="w-[85vw] sm:w-[400px] overflow-y-auto bg-card p-0 flex flex-col h-full border-l border-border">
                  <RightSidebarContent 
                    activeLeadId={activeLeadId}
                    leadDetails={leadDetails}
                    activeStageConfig={activeStageConfig}
                    handleShowDebugPrompt={handleShowDebugPrompt}
                    setEditLeadName={setEditLeadName}
                    setEditLeadFbLink={setEditLeadFbLink}
                    setShowEditLead={setShowEditLead}
                    setShowDeleteLead={setShowDeleteLead}
                  />
                </SheetContent>
              </Sheet>
            </header>
            
            {/* Scrollable Message History */}
            <div className="flex-1 overflow-y-auto min-h-0 p-6 flex flex-col gap-6 bg-background">
              {(!leadDetails.Conversation || leadDetails.Conversation.length === 0) ? (
                <div className="m-auto text-muted-foreground text-center flex flex-col items-center gap-2">
                  <span className="material-symbols-sharp text-4xl opacity-50">chat_bubble</span>
                  <p>No messages yet. Send a message to start the funnel.</p>
                </div>
              ) : (
                leadDetails.Conversation.map((msg: any) => (
                  <div key={msg.id.toString()} className={`flex flex-col max-w-[90%] md:max-w-[75%] ${msg.role === 'user' ? 'self-end items-end' : 'self-start items-start'}`}>
                    
                    {/* Header */}
                    <div className={`flex items-center gap-3 mb-1.5 px-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                       <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                         {msg.role === 'user' ? 'Lead' : 'AI Draft'}
                       </span>
                       <div className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
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
              {/* Action Toolbar */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-secondary/30 overflow-x-auto shadow-inner [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">


                <Button 
                  variant="outline"
                  className="rounded-full shadow-sm bg-card hover:bg-secondary text-card-foreground"
                  onClick={handleNoResponseFollowUp} 
                  disabled={isLoading}
                  title="Generate follow-up using the Simulated Time"
                >
                  <span className="material-symbols-sharp mr-2 text-primary text-[1.1rem]">schedule</span>
                  Follow Up
                </Button>

                <div className="flex items-center gap-2 bg-card px-3 py-1.5 rounded-full border border-border shadow-sm whitespace-nowrap" title="Simulate Time (Optional)">
                  <span className="material-symbols-sharp text-muted-foreground text-[1.1rem]">update</span>
                  <input 
                    type="datetime-local" 
                    value={simulatedTime}
                    onChange={(e) => setSimulatedTime(e.target.value)}
                    className="border-none text-xs outline-none bg-transparent text-foreground cursor-pointer"
                  />
                </div>
              </div>

              {/* Chat Input */}
              <div className="p-4 flex gap-3 items-end bg-card">
                <Textarea 
                  className="flex-1 min-h-[50px] max-h-[200px] bg-background resize-y shadow-inner"
                  placeholder="Simulate a message from the lead..."
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  disabled={isLoading}
                />
                <Button 
                  size="icon"
                  className="shrink-0 w-12 h-12 rounded-full shadow-md"
                  onClick={handleSendMessage} 
                  disabled={isLoading || !inputText.trim()}
                >
                  <span className="material-symbols-sharp">send</span>
                </Button>
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

      {/* Right Sidebar - State Inspector (Desktop) */}
      <aside className="hidden lg:flex flex-col h-full bg-surface border-l border-border min-h-0" >
        <RightSidebarContent 
          activeLeadId={activeLeadId}
          leadDetails={leadDetails}
          activeStageConfig={activeStageConfig}
          handleShowDebugPrompt={handleShowDebugPrompt}
          setEditLeadName={setEditLeadName}
          setEditLeadFbLink={setEditLeadFbLink}
          setShowEditLead={setShowEditLead}
          setShowDeleteLead={setShowDeleteLead}
        />
      </aside>

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
              <div className="text-sm text-muted-foreground py-8 text-center">No messages in this conversation yet.</div>
            ) : (
              <div className="space-y-2 max-h-[65vh] overflow-y-auto pr-2 custom-scrollbar">
                {/* Insert at top */}
                <div className="flex justify-center py-1 opacity-0 hover:opacity-100 transition-opacity z-10 relative">
                  <Button size="sm" variant="outline" className="h-6 rounded-full text-xs bg-background border-border shadow-sm" onClick={() => setInsertTargetMsgId(null)}>
                    <span className="material-symbols-sharp text-[1rem]">add</span>
                  </Button>
                </div>

                {insertTargetMsgId === null && (
                  <div className="bg-secondary/40 p-3 rounded-md border border-border flex flex-col gap-2 shadow-inner">
                    <div className="flex gap-2">
                      <Button variant={insertRole === 'user' ? 'default' : 'outline'} size="sm" onClick={() => setInsertRole('user')} className="h-7 text-xs">Lead</Button>
                      <Button variant={insertRole === 'assistant' ? 'default' : 'outline'} size="sm" onClick={() => setInsertRole('assistant')} className="h-7 text-xs">AI Draft</Button>
                      <Button variant={insertRole === 'stage' ? 'default' : 'outline'} size="sm" onClick={() => setInsertRole('stage')} className="h-7 text-xs">Stage Marker</Button>
                    </div>
                    {insertRole === 'stage' ? (
                      <select 
                        value={insertContent} 
                        onChange={e => setInsertContent(e.target.value)}
                        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      >
                        <option value="">-- Select Stage --</option>
                        {[1, 2, 3, 4, 5, 6].map(num => (
                          <option key={num} value={`[[STAGE_MARKER:${num}]]`}>Stage {num}</option>
                        ))}
                      </select>
                    ) : (
                      <Textarea value={insertContent} onChange={e => setInsertContent(e.target.value)} placeholder="Type new message..." className="text-sm min-h-[60px]" />
                    )}
                    <div className="flex justify-end gap-2 mt-1">
                      <Button variant="outline" size="sm" onClick={() => { setInsertTargetMsgId(undefined); setInsertContent(''); }} className="h-7 text-xs">Cancel</Button>
                      <Button size="sm" className="h-7 text-xs" onClick={async () => {
                        if (!insertContent.trim()) return;
                        await insertConversationMessage(editMemoryLeadId, insertRole === 'stage' ? 'assistant' : insertRole, insertContent, null);
                        setInsertTargetMsgId(undefined);
                        setInsertContent('');
                        toast.success('Message inserted');
                        const data = await getLeadDetails(editMemoryLeadId);
                        setEditMemoryConversations(data?.Conversation || []);
                        if (activeLeadId === editMemoryLeadId) {
                          const activeData = await getLeadDetails(activeLeadId);
                          setLeadDetails(JSON.parse(JSON.stringify(activeData)));
                        }
                      }}>Insert</Button>
                    </div>
                  </div>
                )}

                  {editMemoryConversations.map((msg: any) => (
                    <React.Fragment key={msg.id.toString()}>
                      {(() => {
                        if (msg.content.startsWith('[[STAGE_MARKER:')) {
                          const stageNum = msg.content.match(/\d+/)?.[0] || '?';
                          return (
                            <div className="flex items-center gap-4 py-4 group relative">
                              <div className="flex-1 h-[1px] bg-border"></div>
                              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-background px-3 border border-border rounded-full shadow-sm">
                                Stage {stageNum} Started Here
                              </span>
                              <div className="flex-1 h-[1px] bg-border"></div>
                              
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="absolute right-0 opacity-0 group-hover:opacity-100 h-6 w-6 text-destructive bg-background shadow-sm border border-border rounded-full"
                                onClick={async () => {
                                  if (!confirm('Remove this stage marker?')) return;
                                  await editConversationMessage(msg.id.toString(), '__DELETE__');
                                  toast.success('Marker removed');
                                  const data = await getLeadDetails(editMemoryLeadId);
                                  setEditMemoryConversations(data?.Conversation || []);
                                }}
                              >
                                <span className="material-symbols-sharp text-[0.9rem]">close</span>
                              </Button>
                            </div>
                          );
                        }
                        
                        return (
                          <div
                            className={`flex items-start gap-3 p-3 rounded-md border shadow-sm group cursor-pointer transition-colors ${editingMsgId === msg.id.toString() ? 'bg-primary/5 border-primary/30' : 'bg-card border-border hover:border-primary/20 hover:bg-card/80'}`}
                            onClick={() => {
                              if (editingMsgId === msg.id.toString()) {
                                setEditingMsgId(null);
                              } else {
                                setEditingMsgId(msg.id.toString());
                                setEditingMsgContent(msg.content);
                              }
                            }}
                          >
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase shrink-0 mt-0.5 tracking-wider ${msg.role === 'user' ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                              {msg.role === 'user' ? 'Lead' : 'AI'}
                            </span>
                            <div className="text-sm break-words flex-1 whitespace-pre-wrap text-foreground">
                              {editingMsgId === msg.id.toString() ? (
                                <div className="flex flex-col gap-2" onClick={e => e.stopPropagation()}>
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xs text-muted-foreground">Role:</span>
                                    <Button
                                      variant={msg.role === 'user' ? 'default' : 'outline'} size="sm"
                                      className="h-6 text-xs"
                                      onClick={async () => {
                                        const newRole = msg.role === 'user' ? 'assistant' : 'user';
                                        await editConversationMessage(msg.id.toString(), editingMsgContent, newRole);
                                        toast.success('Role updated');
                                        const data = await getLeadDetails(editMemoryLeadId);
                                        setEditMemoryConversations(data?.Conversation || []);
                                        if (activeLeadId === editMemoryLeadId) {
                                          const activeData = await getLeadDetails(activeLeadId);
                                          setLeadDetails(JSON.parse(JSON.stringify(activeData)));
                                        }
                                        setEditingMsgId(null);
                                      }}
                                    >
                                      Switch to {msg.role === 'user' ? 'AI' : 'Lead'}
                                    </Button>
                                  </div>
                                  <Textarea value={editingMsgContent} onChange={e => setEditingMsgContent(e.target.value)} className="text-sm min-h-[60px]" />
                                  <div className="flex justify-between gap-2">
                                    <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive" onClick={async () => {
                                      if (!confirm('Delete this message?')) return;
                                      await editConversationMessage(msg.id.toString(), '__DELETE__');
                                      setEditingMsgId(null);
                                      toast.success('Message deleted');
                                      const data = await getLeadDetails(editMemoryLeadId);
                                      setEditMemoryConversations(data?.Conversation || []);
                                      if (activeLeadId === editMemoryLeadId) {
                                        const activeData = await getLeadDetails(activeLeadId);
                                        setLeadDetails(JSON.parse(JSON.stringify(activeData)));
                                      }
                                    }}>
                                      <span className="material-symbols-sharp text-[1rem] mr-1">delete</span>Delete
                                    </Button>
                                    <div className="flex gap-2">
                                      <Button variant="outline" size="sm" onClick={() => setEditingMsgId(null)} className="h-7 text-xs">Cancel</Button>
                                      <Button size="sm" className="h-7 text-xs" onClick={async () => {
                                        if (!editingMsgContent.trim()) return;
                                        await editConversationMessage(msg.id.toString(), editingMsgContent);
                                        setEditingMsgId(null);
                                        toast.success('Message updated');
                                        const data = await getLeadDetails(editMemoryLeadId);
                                        setEditMemoryConversations(data?.Conversation || []);
                                        if (activeLeadId === editMemoryLeadId) {
                                          const activeData = await getLeadDetails(activeLeadId);
                                          setLeadDetails(JSON.parse(JSON.stringify(activeData)));
                                        }
                                      }}>Save</Button>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                msg.content
                              )}
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

                    {insertTargetMsgId === msg.id.toString() && (
                      <div className="bg-secondary/40 p-3 rounded-md border border-border flex flex-col gap-2 shadow-inner">
                        <div className="flex gap-2">
                          <Button variant={insertRole === 'user' ? 'default' : 'outline'} size="sm" onClick={() => setInsertRole('user')} className="h-7 text-xs">Lead</Button>
                          <Button variant={insertRole === 'assistant' ? 'default' : 'outline'} size="sm" onClick={() => setInsertRole('assistant')} className="h-7 text-xs">AI Draft</Button>
                          <Button variant={insertRole === 'stage' ? 'default' : 'outline'} size="sm" onClick={() => setInsertRole('stage')} className="h-7 text-xs">Stage Marker</Button>
                        </div>
                        {insertRole === 'stage' ? (
                          <select 
                            value={insertContent} 
                            onChange={e => setInsertContent(e.target.value)}
                            className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                          >
                            <option value="">-- Select Stage --</option>
                            {[1, 2, 3, 4, 5, 6].map(num => (
                              <option key={num} value={`[[STAGE_MARKER:${num}]]`}>Stage {num}</option>
                            ))}
                          </select>
                        ) : (
                          <Textarea value={insertContent} onChange={e => setInsertContent(e.target.value)} placeholder="Type new message..." className="text-sm min-h-[60px]" />
                        )}
                        <div className="flex justify-end gap-2 mt-1">
                          <Button variant="outline" size="sm" onClick={() => { setInsertTargetMsgId(undefined); setInsertContent(''); }} className="h-7 text-xs">Cancel</Button>
                          <Button size="sm" className="h-7 text-xs" onClick={async () => {
                            if (!insertContent.trim()) return;
                            await insertConversationMessage(editMemoryLeadId, insertRole === 'stage' ? 'assistant' : insertRole, insertContent, msg.id.toString());
                            setInsertTargetMsgId(undefined);
                            setInsertContent('');
                            toast.success('Message inserted');
                            const data = await getLeadDetails(editMemoryLeadId);
                            setEditMemoryConversations(data?.Conversation || []);
                            if (activeLeadId === editMemoryLeadId) {
                              const activeData = await getLeadDetails(activeLeadId);
                              setLeadDetails(JSON.parse(JSON.stringify(activeData)));
                            }
                          }}>Insert</Button>
                        </div>
                      </div>
                    )}
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

      {/* Delete Lead Modal */}
      <Dialog open={showDeleteLead} onOpenChange={setShowDeleteLead}>
        <DialogContent className="sm:max-w-md border-destructive/20">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <span className="material-symbols-sharp">warning</span>
              Delete Lead
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-sm text-foreground">
              Are you sure you want to delete <strong>{leadDetails?.name}</strong>?
            </p>
            <p className="text-sm text-muted-foreground">
              All chat history, state, and context for this lead will be permanently deleted. This action cannot be undone.
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowDeleteLead(false)} disabled={isLoading}>
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
              Active System Prompt (Stage {leadDetails?.LeadState?.stage})
            </DialogTitle>
            <DialogDescription>
              This is the exact instructional prompt given to the AI for the current stage. It governs how the AI will draft its response.
            </DialogDescription>
          </DialogHeader>

          <div className="bg-secondary text-foreground p-4 rounded-md overflow-y-auto max-h-[500px] text-sm font-mono whitespace-pre-wrap border border-border shadow-inner mt-4">
            {debugPromptText}
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
