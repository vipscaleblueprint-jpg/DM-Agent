'use client';

import { useState } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { Toaster } from 'sonner';
import { PanelLeft, Bot, X } from 'lucide-react';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* ── Global Header ── */}
      <header className="flex items-center h-11 shrink-0 border-b border-zinc-800 bg-zinc-950 px-3 gap-3 z-50">
        {/* VIP logo placeholder */}
        <div className="flex aspect-square size-6 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-purple-500 to-pink-500 shadow shadow-purple-500/30">
          <span className="text-[9px] font-bold text-white leading-none">VP</span>
        </div>

        <div className="h-4 w-px bg-zinc-700 shrink-0" />

        {/* Sidebar toggle */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="flex items-center justify-center size-7 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          title="Toggle VIP Scale sidebar"
        >
          <PanelLeft className="size-4" />
        </button>

        {/* App name */}
        <div className="flex items-center gap-2">
          <Bot className="size-4 text-blue-400" />
          <span className="text-sm font-semibold text-white tracking-tight">DM Agent</span>
        </div>
      </header>

      {/* ── Body: sidebar + main ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* VIP Scale sidebar — controlled by header toggle */}
        <div className={`shrink-0 transition-all duration-300 ease-in-out overflow-hidden ${sidebarOpen ? 'w-auto' : 'w-0'}`}>
          <Sidebar collapsed={false} />
        </div>

        {/* DM Agent content */}
        <main className="flex-1 overflow-auto min-w-0">
          {children}
        </main>
      </div>

      <Toaster richColors closeButton position="bottom-right" />
    </div>
  );
}
