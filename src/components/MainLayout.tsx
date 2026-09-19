'use client';
import { useState } from 'react';
import { Sidebar } from './Sidebar';
import { PanelLeft, PanelLeftClose } from 'lucide-react';

export function MainLayout({ children }: { children: React.ReactNode }) {
    // Manage the collapse state here so both the Navbar and Sidebar can access it
    const [collapsed, setCollapsed] = useState(true);

    return (
        <div className="fixed inset-0 flex w-full bg-[#09090b] text-white overflow-hidden">
            {/* Pass the state down to the Sidebar */}
            <Sidebar collapsed={collapsed} />

            {/* Main Content Area */}
            <div className="flex flex-1 flex-col overflow-hidden min-h-0 min-w-0">

                {/* Top Navbar Header */}
                <header className="flex h-14 shrink-0 items-center justify-between border-b border-[hsl(240,3.7%,15.9%)] px-4">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setCollapsed(!collapsed)}
                            className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
                        >
                            {collapsed ? <PanelLeft className="size-5" /> : <PanelLeftClose className="size-5" />}
                        </button>
                    </div>
                </header>

                {/* Page Content */}
                <main className="flex flex-1 flex-col overflow-hidden bg-[#09090b] min-h-0">
                    {children}
                </main>
            </div>
        </div>
    );
}