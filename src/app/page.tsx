'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { getLeads, getLeadDetails, generateDraftResponse, addLead, getPresignedUrl, sendLeadMessage, saveClientContext, uploadFileToR2, getGlobalClient, getPromptForStage, editLead, removeLead } from './actions';

export default function DMApp() {
  const [leads, setLeads] = useState<any[]>([]);
  const [activeLeadId, setActiveLeadId] = useState<string | null>(null);
  const [leadDetails, setLeadDetails] = useState<any>(null);
  const [inputText, setInputText] = useState('');
  const [contextText, setContextText] = useState('');
  const [contextUrls, setContextUrls] = useState<string[]>([]);
  const [isSavingContext, setIsSavingContext] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Add Lead Modal State
  const [showAddLead, setShowAddLead] = useState(false);
  const [newLeadName, setNewLeadName] = useState('');
  const [newLeadFbLink, setNewLeadFbLink] = useState('');

  // Edit Lead Modal State
  const [showEditLead, setShowEditLead] = useState(false);
  const [editLeadName, setEditLeadName] = useState('');
  const [editLeadFbLink, setEditLeadFbLink] = useState('');

  // Global Context Modal State
  const [showContextModal, setShowContextModal] = useState(false);

  // Debug Modal State
  const [showDebugModal, setShowDebugModal] = useState(false);
  const [debugPromptText, setDebugPromptText] = useState('');

  // Simulated Time State
  const [simulatedTime, setSimulatedTime] = useState<string>('');

  const contextInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchLeads = async () => {
    try {
      const data = await getLeads();
      setLeads(JSON.parse(JSON.stringify(data)));
    } catch (err) {
      console.error(err);
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

  useEffect(() => {
    fetchLeads();
  }, []);

  useEffect(() => {
    if (activeLeadId) {
      fetchLeadDetails(activeLeadId);
      setInputText('');
    }
  }, [activeLeadId]);

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
    if (!newLeadName.trim()) return;
    
    setIsLoading(true);
    const newId = await addLead(newLeadName, newLeadFbLink);
    await fetchLeads();
    setActiveLeadId(newId);
    setNewLeadName('');
    setNewLeadFbLink('');
    setShowAddLead(false);
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

  const handleDeleteLead = async () => {
    if (!activeLeadId) return;
    if (confirm("Are you sure you want to delete this lead? All chat history and state will be lost forever.")) {
      setIsLoading(true);
      await removeLead(activeLeadId);
      setActiveLeadId(null);
      setLeadDetails(null);
      await fetchLeads();
      setIsLoading(false);
    }
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
        alert(`Loaded context from ${file.name}. Click Save Context to apply.`);
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
        alert(`Upload failed: ${error}`);
      } else if (fileUrl) {
        const publicUrl = process.env.NEXT_PUBLIC_R2_URL || 'https://aidm.xfnite.cloud';
        const finalUrl = `${publicUrl}/${fileUrl}`;
        setContextUrls(prev => [...prev, finalUrl]);
        alert('File uploaded to R2. Click Save Context to apply globally.');
      }
    } catch (err) {
      console.error('Upload failed', err);
      alert('Upload failed.');
    }
    setIsSavingContext(false);
  };

  const handleSaveContext = async () => {
    setIsSavingContext(true);
    const finalContext = [contextText.trim(), ...contextUrls].filter(Boolean).join('\n\n');
    await saveClientContext(null, finalContext);
    alert('Context saved. It will apply to all leads.');
    setIsSavingContext(false);
    setShowContextModal(false);
  };

  const openContextModal = async () => {
    setShowContextModal(true);
    try {
      const client = await getGlobalClient();
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
    } catch (e) {
      console.error(e);
    }
  };

  const handleShowDebugPrompt = async () => {
    if (!leadDetails?.LeadState?.stage) return;
    try {
      const promptText = await getPromptForStage(leadDetails.LeadState.stage);
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
    await fetchLeadDetails(activeLeadId as string);
    setIsLoading(false);
  };

  const handleDraftResponse = async () => {
    if (!leadDetails) return;
    
    setIsLoading(true);
    // Convert local datetime-local string to ISO string if provided
    const simTimeIso = simulatedTime ? new Date(simulatedTime).toISOString() : undefined;
    const res = await generateDraftResponse(leadDetails.id, leadDetails.client_id, simTimeIso);
    
    if (res.success) {
      setInputText('');
      await fetchLeadDetails(activeLeadId as string);
    } else {
      alert(`Draft generation failed: ${res.error}`);
    }
    setIsLoading(false);
  };

  const handleNoResponseFollowUp = async () => {
    if (!leadDetails || !leadDetails.Conversation?.length) return;
    const lastMsg = leadDetails.Conversation[leadDetails.Conversation.length - 1];
    if (lastMsg.role !== 'assistant') {
      alert("The last message must be from the AI to simulate a non-response follow-up.");
      return;
    }
    
    setIsLoading(true);
    const simTimeIso = simulatedTime ? new Date(simulatedTime).toISOString() : new Date().toISOString();
    const res = await generateDraftResponse(leadDetails.id, leadDetails.client_id, simTimeIso);
    
    if (res.success) {
      setInputText('');
      await fetchLeadDetails(activeLeadId as string);
    } else {
      alert(`Draft generation failed: ${res.error}`);
    }
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

  return (
    <div className="app-container">
      {/* Sidebar - Leads List */}
      <aside className="sidebar" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div className="sidebar-header" style={{ paddingBottom: '1rem' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="material-symbols-sharp">smart_toy</span>
              DM Agent
            </div>
            <button 
              className="btn btn-secondary" 
              style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem', background: 'transparent', border: 'none' }} 
              onClick={openContextModal}
              title="Global Client Context"
            >
              <span className="material-symbols-sharp" style={{ fontSize: '1.2rem' }}>settings</span>
            </button>
          </h2>
          <div style={{ position: 'relative' }}>
            <span className="material-symbols-sharp" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: '1.2rem' }}>search</span>
            <input 
              type="text" 
              placeholder="Search Leads..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '100%', padding: '0.6rem 0.6rem 0.6rem 2.2rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', outline: 'none' }}
            />
          </div>
        </div>
        
        <ul className="lead-list" style={{ flex: 1, overflowY: 'auto' }}>
          {filteredLeads.map((lead) => {
            return (
            <li 
              key={lead.id} 
              className={`lead-item ${activeLeadId === lead.id ? 'active' : ''}`}
              onClick={() => setActiveLeadId(lead.id)}
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
            </li>
            );
          })}
          {filteredLeads.length === 0 && (
            <div style={{ padding: '1.5rem', color: 'var(--muted)', fontSize: '0.9rem', textAlign: 'center' }}>
              No leads found.
            </div>
          )}
        </ul>

        {/* Add Lead Button */}
        <div style={{ padding: '1rem', borderTop: '1px solid var(--border)', background: 'var(--surface-hover)' }}>
          <button className="btn btn-secondary" onClick={() => setShowAddLead(true)} style={{ width: '100%', display: 'flex', justifyContent: 'center' }} disabled={isLoading}>
            <span className="material-symbols-sharp" style={{ fontSize: '1.2rem' }}>add</span>
            Add Lead
          </button>
        </div>
      </aside>

      {/* Main Workspace Area (Chat Interface) */}
      <main className="ingestion-area" style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        {leadDetails ? (
          <>
            <header className="ingestion-header" style={{ flexShrink: 0 }}>
              <div>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  Chat with {leadDetails.name}
                  <button onClick={() => {
                    setEditLeadName(leadDetails.name);
                    setEditLeadFbLink(leadDetails.fb_link || '');
                    setShowEditLead(true);
                  }} className="btn btn-secondary" style={{ padding: '0.2rem', background: 'transparent', border: 'none', color: 'var(--muted)' }} title="Edit Lead">
                    <span className="material-symbols-sharp" style={{ fontSize: '1rem' }}>edit</span>
                  </button>
                  <button onClick={handleDeleteLead} className="btn btn-secondary" style={{ padding: '0.2rem', background: 'transparent', border: 'none', color: '#ef4444' }} title="Delete Lead">
                    <span className="material-symbols-sharp" style={{ fontSize: '1rem' }}>delete</span>
                  </button>
                </h3>
                {leadDetails.fb_link && (
                  <a href={leadDetails.fb_link} target="_blank" rel="noreferrer" style={{ fontSize: '0.85rem', color: 'var(--primary)' }}>
                    {leadDetails.fb_link}
                  </a>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button 
                  className="btn btn-secondary" 
                  style={{ height: '100%', fontSize: '0.75rem', padding: '0.5rem 0.75rem' }}
                  onClick={handleNoResponseFollowUp} 
                  disabled={isLoading}
                  title="Generate follow-up using the Simulated Time"
                >
                  <span className="material-symbols-sharp" style={{ fontSize: '1rem', color: '#ea580c' }}>schedule</span>
                  Didn't Respond
                </button>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px', marginLeft: '0.5rem', paddingLeft: '0.5rem', borderLeft: '1px solid var(--border)' }}>
                  <label style={{ fontSize: '0.65rem', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 600 }}>Simulate Time (Optional)</label>
                  <input 
                    type="datetime-local" 
                    value={simulatedTime}
                    onChange={(e) => setSimulatedTime(e.target.value)}
                    style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', borderRadius: '4px', border: '1px solid var(--border)' }}
                    title="Leave empty to use real current time"
                  />
                </div>
                <button 
                  className="btn" 
                  style={{ background: '#2563eb', color: 'white', height: '100%', marginLeft: '0.5rem' }}
                  onClick={handleDraftResponse} 
                  disabled={isLoading}
                >
                  <span className="material-symbols-sharp">auto_awesome</span>
                  {isLoading ? 'Thinking...' : 'Draft Response'}
                </button>
              </div>
            </header>
            
            {/* Scrollable Message History */}
            <div className="ingestion-workspace" style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {(!leadDetails.Conversation || leadDetails.Conversation.length === 0) ? (
                <div style={{ margin: 'auto', color: 'var(--muted)', textAlign: 'center' }}>
                  No messages yet. Send a message to start the funnel.
                </div>
              ) : (
                leadDetails.Conversation.map((msg: any) => (
                  <div key={msg.id.toString()} style={{
                    alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    background: msg.role === 'user' ? '#e0f2fe' : '#ffffff',
                    border: msg.role === 'user' ? '1px solid #bae6fd' : '1px solid #e2e8f0',
                    padding: '1rem',
                    borderRadius: '8px',
                    maxWidth: '80%',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                  }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                      {msg.role === 'user' ? 'Lead (Pasted)' : 'AI Draft'}
                      {msg.role === 'assistant' && (
                        <button 
                          onClick={() => { navigator.clipboard.writeText(msg.content); alert('Copied!'); }}
                          style={{ marginLeft: '10px', background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}
                        >
                          COPY
                        </button>
                      )}
                    </div>
                    <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: '1.5' }}>
                      {msg.content}
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Bottom Input Area */}
            <div style={{ flexShrink: 0, padding: '1rem', background: '#ffffff', borderTop: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
                <textarea 
                  style={{ flex: 1, minHeight: '60px', padding: '0.75rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', resize: 'vertical' }}
                  placeholder="Simulate a message from the lead..."
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  disabled={isLoading}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <button type="button" className="btn" style={{ padding: '0.5rem 1rem', background: '#16a34a', color: 'white' }} onClick={handleSendMessage} disabled={isLoading || !inputText.trim()}>
                    <span className="material-symbols-sharp">send</span>
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--muted)' }}>
            Select a lead to open their workspace.
          </div>
        )}
      </main>

      {/* Right Sidebar - State Inspector */}
      <aside className="state-inspector">
        <h2>Lead State</h2>
        <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
          Real-time view of the agent's memory.
        </p>

        {leadDetails?.LeadState ? (
          <>
            <div className="state-card">
              <h3><span className="material-symbols-sharp" style={{ fontSize: '1.2rem' }}>analytics</span> Classification</h3>
              <div className="state-row">
                <span className="state-label">Stage</span>
                <span className={`badge stage-${leadDetails.LeadState.stage}`}>
                  Stage {leadDetails.LeadState.stage}: {leadDetails.LeadState.stageName}
                </span>
              </div>
              <div className="state-row">
                <span className="state-label">Primary Intent</span>
                <span className="state-value">{leadDetails.LeadState.primary_intent_id || 'UNKNOWN'}</span>
              </div>
              <div className="state-row">
                <span className="state-label">Connection</span>
                <span className="state-value">{leadDetails.LeadState.connectionLevel}</span>
              </div>
            </div>

            <div className="state-card">
              <h3><span className="material-symbols-sharp" style={{ fontSize: '1.2rem' }}>person</span> Profile & Goals</h3>
              <div className="state-row" style={{ flexDirection: 'column', gap: '0.25rem', alignItems: 'flex-start' }}>
                <span className="state-label" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Current Situation</span>
                <span className="state-value" style={{ textAlign: 'left', maxWidth: '100%', fontWeight: 400, color: 'var(--foreground)', lineHeight: 1.4 }}>{leadDetails.LeadState.currentSituation || '-'}</span>
              </div>
              <div className="state-row" style={{ flexDirection: 'column', gap: '0.25rem', alignItems: 'flex-start' }}>
                <span className="state-label" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pain Point</span>
                <span className="state-value" style={{ textAlign: 'left', maxWidth: '100%', fontWeight: 400, color: 'var(--foreground)', lineHeight: 1.4 }}>{leadDetails.LeadState.painPoint || '-'}</span>
              </div>
              <div className="state-row" style={{ flexDirection: 'column', gap: '0.25rem', alignItems: 'flex-start' }}>
                <span className="state-label" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Goal</span>
                <span className="state-value" style={{ textAlign: 'left', maxWidth: '100%', fontWeight: 400, color: 'var(--foreground)', lineHeight: 1.4 }}>{leadDetails.LeadState.goal || '-'}</span>
              </div>
              <div className="state-row" style={{ flexDirection: 'column', gap: '0.25rem', alignItems: 'flex-start' }}>
                <span className="state-label" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Desired Future</span>
                <span className="state-value" style={{ textAlign: 'left', maxWidth: '100%', fontWeight: 400, color: 'var(--foreground)', lineHeight: 1.4 }}>{leadDetails.LeadState.desiredFuture || '-'}</span>
              </div>
            </div>
            
            <div className="state-card">
              <h3><span className="material-symbols-sharp" style={{ fontSize: '1.2rem' }}>lightbulb</span> Diagnostics</h3>
              <div className="state-row" style={{ flexDirection: 'column', gap: '0.25rem', alignItems: 'flex-start' }}>
                <span className="state-label" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Next Stage Requirement</span>
                <span className="state-value" style={{ textAlign: 'left', maxWidth: '100%', fontWeight: 500, color: 'var(--foreground)', lineHeight: 1.4 }}>
                  {leadDetails.LeadState.nextStageRequirement || 'None identified yet.'}
                </span>
              </div>
            </div>

            <div className="state-card" style={{ background: 'rgba(234, 179, 8, 0.05)', border: '1px solid rgba(234, 179, 8, 0.2)' }}>
              <h3 style={{ color: '#ca8a04' }}><span className="material-symbols-sharp" style={{ fontSize: '1.2rem' }}>bug_report</span> Debug Logs</h3>
              <div className="state-row" style={{ flexDirection: 'column', gap: '0.25rem', alignItems: 'flex-start' }}>
                <span className="state-label" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Reason for Stage {leadDetails.LeadState.stage}</span>
                <span className="state-value" style={{ textAlign: 'left', maxWidth: '100%', fontWeight: 400, color: 'var(--foreground)', lineHeight: 1.4 }}>
                  {leadDetails.LeadState.lastStageChangeReason || 'No reasoning captured yet.'}
                </span>
              </div>
              <button 
                className="btn btn-secondary" 
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
      </aside>

      {/* Add Lead Modal */}
      {showAddLead && (
        <div className="modal-backdrop" onClick={() => !isLoading && setShowAddLead(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="material-symbols-sharp">person_add</span>
              Add New Lead
            </h3>
            <form onSubmit={handleAddLead}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Lead Name</label>
                <input 
                  type="text" 
                  value={newLeadName}
                  onChange={(e) => setNewLeadName(e.target.value)}
                  placeholder="e.g. Dr. Jane Smith"
                  required
                  autoFocus
                />
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Facebook Profile URL (Optional)</label>
                <input 
                  type="url" 
                  value={newLeadFbLink}
                  onChange={(e) => setNewLeadFbLink(e.target.value)}
                  placeholder="https://facebook.com/..."
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddLead(false)} disabled={isLoading}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isLoading || !newLeadName.trim()}>
                  {isLoading ? 'Adding...' : 'Add Lead'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Lead Modal */}
      {showEditLead && (
        <div className="modal-backdrop" onClick={() => !isLoading && setShowEditLead(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="material-symbols-sharp">edit</span>
              Edit Lead
            </h3>
            <form onSubmit={handleEditLead}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Lead Name</label>
                <input 
                  type="text" 
                  value={editLeadName}
                  onChange={(e) => setEditLeadName(e.target.value)}
                  placeholder="e.g. Dr. Jane Smith"
                  required
                  autoFocus
                />
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Facebook Profile URL (Optional)</label>
                <input 
                  type="url" 
                  value={editLeadFbLink}
                  onChange={(e) => setEditLeadFbLink(e.target.value)}
                  placeholder="https://facebook.com/..."
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditLead(false)} disabled={isLoading}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isLoading || !editLeadName.trim()}>
                  {isLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Global Context Modal */}
      {showContextModal && (
        <div className="modal-backdrop" onClick={() => !isSavingContext && setShowContextModal(false)}>
          <div className="modal-content" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="material-symbols-sharp">description</span>
                Global Client Context
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="button" className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }} onClick={() => contextInputRef.current?.click()} title="Read .txt/.csv into text">
                  Upload .txt
                </button>
                <button type="button" className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }} onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.onchange = (e) => handleContextFileUploadR2(e as unknown as React.ChangeEvent<HTMLInputElement>);
                  input.click();
                }} title="Upload File to R2">
                  Upload File
                </button>
              </div>
            </h3>
            
            <p style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '1rem' }}>
              This context applies to all leads. Upload product documents, business rules, or past research here to automatically inform the AI draft responses.
            </p>

            <input type="file" ref={contextInputRef} style={{ display: 'none' }} accept=".txt,.md,.csv" onChange={handleContextUpload} />
            
            <textarea 
              style={{ width: '100%', minHeight: '300px', padding: '1rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', fontSize: '0.9rem', resize: 'vertical', marginBottom: '1.5rem' }}
              placeholder="Paste business rules, products, or base prompts for this client..."
              value={contextText}
              onChange={e => setContextText(e.target.value)}
            />

            {contextUrls.length > 0 && (
              <div style={{ marginBottom: '1.5rem' }}>
                <h4 style={{ fontSize: '0.85rem', marginBottom: '0.5rem', color: 'var(--muted)', textTransform: 'uppercase' }}>Attached Context Files</h4>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {contextUrls.map((url, i) => (
                    <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--surface-hover)', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border)' }}>
                      <span className="material-symbols-sharp" style={{ fontSize: '1rem', color: 'var(--primary)' }}>link</span>
                      <a href={url} target="_blank" rel="noreferrer" style={{ fontSize: '0.8rem', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {url}
                      </a>
                      <button type="button" className="btn btn-secondary" style={{ padding: '0.1rem 0.3rem', fontSize: '0.7rem' }} onClick={() => setContextUrls(prev => prev.filter((_, idx) => idx !== i))}>
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowContextModal(false)} disabled={isSavingContext}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={handleSaveContext} disabled={isSavingContext}>
                {isSavingContext ? 'Saving...' : 'Save Context'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Debug Logs Modal */}
      {showDebugModal && (
        <div className="modal-backdrop" onClick={() => setShowDebugModal(false)}>
          <div className="modal-content" style={{ maxWidth: '800px', width: '90%' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ca8a04' }}>
                <span className="material-symbols-sharp">bug_report</span>
                Active System Prompt (Stage {leadDetails?.LeadState?.stage})
              </div>
              <button type="button" className="btn btn-secondary" style={{ padding: '0.2rem', background: 'transparent', border: 'none' }} onClick={() => setShowDebugModal(false)}>
                <span className="material-symbols-sharp">close</span>
              </button>
            </h3>
            
            <p style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '1rem' }}>
              This is the exact instructional prompt given to the AI for the current stage. It governs how the AI will draft its response.
            </p>

            <div style={{ background: '#1e1e1e', color: '#d4d4d4', padding: '1rem', borderRadius: 'var(--radius)', overflowY: 'auto', maxHeight: '500px', fontSize: '0.85rem', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
              {debugPromptText}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
