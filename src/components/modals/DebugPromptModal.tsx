'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

// "View Active System Prompt": exactly what the model receives for the lead's next draft
export function DebugPromptModal({ open, onOpenChange, stage, promptText }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stage?: number;
  promptText: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary">
            <span className="material-symbols-sharp">bug_report</span>
            Active Prompt (Stage {stage})
          </DialogTitle>
          <DialogDescription>
            This is exactly what the AI receives for its next draft: the stage prompt, lead profile, product PVPS, global client context, attached files and chat history.
          </DialogDescription>
        </DialogHeader>

        <div className="bg-secondary text-foreground p-4 rounded-md overflow-y-auto max-h-[500px] text-sm font-mono whitespace-pre-wrap border border-border shadow-inner mt-4">
          {promptText}
        </div>
      </DialogContent>
    </Dialog>
  );
}
