'use client';

// Right-hand "Lead State" panel: what the agent currently remembers about the open lead
export function LeadStatePanel({ leadDetails, activeStageConfig, onShowDebugPrompt }: {
  leadDetails: any;
  activeStageConfig: any;
  onShowDebugPrompt: () => void;
}) {
  const state = leadDetails?.LeadState;

  return (
    <div className="flex-1 overflow-y-auto min-h-0" style={{ padding: '1.5rem' }}>
      <h2>Lead State</h2>
      <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
        Real-time view of the agent&apos;s memory.
      </p>

      {state ? (
        <>
          <div className="bg-background border border-border rounded-md p-4 mb-6">
            <h3><span className="material-symbols-sharp" style={{ fontSize: '1.2rem' }}>analytics</span> Classification</h3>
            <div className="flex justify-between mb-2 text-sm">
              <span className="text-muted-foreground">Stage</span>
              <span className={`badge stage-${state.stage}`}>
                Stage {state.stage}: {state.stageName}
              </span>
            </div>

            <div className="flex justify-between mb-2 text-sm">
              <span className="text-muted-foreground">Lead Status</span>
              <span className={`font-medium text-right max-w-[60%] ${state.leadStatus === 'HOT' ? 'text-red-500' : state.leadStatus === 'NOT_QUALIFIED' ? 'text-zinc-400' : state.leadStatus === 'DONE' ? 'text-emerald-500' : ''}`}>
                {state.leadStatus === 'HOT' ? 'HOT' : state.leadStatus === 'NOT_QUALIFIED' ? 'Not qualified' : state.leadStatus === 'DONE' ? 'Done' : 'Not hot'}
                {(state.leadStatus === 'NOT_QUALIFIED' || state.leadStatus === 'DONE') && state.leadStatusManual ? ' (flagged)' : ''}
              </span>
            </div>
          </div>

          <div className="bg-background border border-border rounded-md p-4 mb-6">
            <h3><span className="material-symbols-sharp" style={{ fontSize: '1.2rem' }}>fact_check</span> Stage {state.stage} Assessment</h3>

            {activeStageConfig?.checklistConfig?.length > 0 ? (
              activeStageConfig.checklistConfig.map((item: any) => {
                const val = state.assessmentData ? state.assessmentData[item.id] : undefined;
                return item.type === 'boolean' ? (
                  <div key={item.id} className="flex justify-between items-center mb-2 text-sm">
                    <span className="text-muted-foreground">{item.label}</span>
                    {val ?
                      <span className="text-green-500 flex items-center gap-1"><span className="material-symbols-sharp text-[1rem]">check_circle</span> Captured</span> :
                      <span className="text-destructive flex items-center gap-1"><span className="material-symbols-sharp text-[1rem]">cancel</span> Missing</span>}
                  </div>
                ) : (
                  <div key={item.id} className="flex justify-between mb-2 text-sm" style={{ flexDirection: 'column', gap: '0.25rem', alignItems: 'flex-start' }}>
                    <span className="text-muted-foreground" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.label}</span>
                    <span className="font-medium text-right max-w-[100%]" style={{ textAlign: 'left', fontWeight: 400, color: 'var(--foreground)', lineHeight: 1.4 }}>
                      {val || '-'}
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="text-sm text-muted-foreground italic mb-4">No checklist criteria defined for this stage.</div>
            )}

            <div className={`${activeStageConfig?.checklistConfig?.length > 0 ? 'mt-4 ' : ''}pt-3 border-t border-border flex flex-col gap-1`}>
              <span className="text-muted-foreground" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Summary</span>
              <span className="text-sm font-medium">{state.leadSummary || 'No summary yet.'}</span>
            </div>
          </div>

          <div className="bg-background border border-border rounded-md p-4 mb-6">
            <h3><span className="material-symbols-sharp" style={{ fontSize: '1.2rem' }}>lightbulb</span> Diagnostics</h3>
            <div className="flex justify-between mb-2 text-sm" style={{ flexDirection: 'column', gap: '0.25rem', alignItems: 'flex-start' }}>
              <span className="text-muted-foreground" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Next Stage Requirement</span>
              <span className="font-medium text-right max-w-[60%]" style={{ textAlign: 'left', maxWidth: '100%', fontWeight: 500, color: 'var(--foreground)', lineHeight: 1.4 }}>
                {state.nextStageRequirement || 'None identified yet.'}
              </span>
            </div>
          </div>

          <div className="bg-background border border-border rounded-md p-4 mb-6" style={{ background: 'rgba(234, 179, 8, 0.05)', border: '1px solid rgba(234, 179, 8, 0.2)' }}>
            <h3 style={{ color: 'hsl(var(--primary))' }}><span className="material-symbols-sharp" style={{ fontSize: '1.2rem' }}>bug_report</span> Debug Logs</h3>
            <div className="flex justify-between mb-2 text-sm" style={{ flexDirection: 'column', gap: '0.25rem', alignItems: 'flex-start' }}>
              <span className="text-muted-foreground" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Reason for Stage {state.stage}</span>
              <span className="font-medium text-right max-w-[60%]" style={{ textAlign: 'left', maxWidth: '100%', fontWeight: 400, color: 'var(--foreground)', lineHeight: 1.4 }}>
                {state.lastStageChangeReason || 'No reasoning captured yet.'}
              </span>
            </div>
            <button
              className="inline-flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground font-medium rounded-md border border-border hover:bg-secondary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ width: '100%', marginTop: '0.75rem', padding: '0.4rem', fontSize: '0.8rem' }}
              onClick={onShowDebugPrompt}
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
  );
}
