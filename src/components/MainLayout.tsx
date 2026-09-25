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
            <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />

            {/* Main Content Area */}
            <div className="flex flex-1 flex-col overflow-hidden min-h-0 min-w-0">

                {/* Page Content */}
                <main className="flex flex-1 flex-col overflow-hidden bg-[#09090b] min-h-0">
                    {children}
                </main>
            </div>
        </div>
    );
}