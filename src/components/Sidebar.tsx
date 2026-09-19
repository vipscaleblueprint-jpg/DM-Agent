'use client';
import { useState } from 'react';
import {
  Bot,
  Sparkles,
  LucideIcon,
  FileText,
  ChevronRight,
  Clock,
  Video,
  History,
  ScrollText,
  Type,
  MessageSquareText,
  Music,
  Image,
  Megaphone,
  Target,
  Shirt,
  Camera,
  TextCursorInput,
  Film,
  ImagePlus,
  Upload,
  Infinity,
  CircleUser,
  BarChart3,
  Wand2,
  PanelsTopLeft,
  Repeat,
  Archive,
  Calendar,
  Download,
  Package,
  Move,
  Eye,
  HardDrive,
  Moon,
  Sun,
  LogOut,
  Rocket,
  UserPlus,
  Link as LinkIcon,
  Users,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';

const VIPSCALE_BASE = 'https://tools.vipscaleph.com';

// ─── Menu data (matching VIPScale structure exactly) ──────────────────────────

const managementItems = [
  { title: 'Dashboard', url: '/protected', icon: PanelsTopLeft, color: 'text-purple-500' },
  { title: 'Galaxy Task', url: '/protected/galaxy-task', icon: Rocket, color: 'text-sky-500' },
  { title: 'SOP', url: '/protected/sop', icon: ScrollText, color: 'text-green-500' },
];

const trackerItems = [
  { title: 'Time Tracker', url: '/protected/time-entry-v2', icon: Clock, color: 'text-pink-600' },
  { title: 'Time Entry Report', url: '/protected/time-entry-reports', icon: BarChart3, color: 'text-pink-600' },
  { title: 'Time Calendar', url: '/protected/time-entry-calendar', icon: Calendar, color: 'text-pink-600' },
  { title: 'Time Track History', url: '/protected/time-track', icon: History, color: 'text-indigo-600' },
];

const clientItems = [
  { title: 'Client Dashboard', url: '/protected/client-dashboard', icon: Users, color: 'text-purple-500' },
  { title: 'Client Hour Tracker', url: '/protected/client-hours', icon: Clock, color: 'text-purple-700' },
  { title: 'Product Dashboard', url: '/protected/product-dashboard', icon: Package, color: 'text-purple-700' },
];

const contractsItems = [
  { title: 'All Contracts', url: '/protected/contracts', icon: FileText, color: 'text-amber-500' },
  { title: 'Create Contract', url: '/protected/contracts/new', icon: Sparkles, color: 'text-amber-500' },
  { title: 'Templates', url: '/protected/contracts/templates', icon: ScrollText, color: 'text-amber-500' },
  { title: 'Proposals Queue', url: '/protected/contracts/proposals', icon: MessageSquareText, color: 'text-amber-500' },
  { title: 'Link Management', url: '/protected/contracts/links', icon: LinkIcon, color: 'text-amber-500' },
  { title: 'R2 Storage Manager', url: '/protected/contracts/storage', icon: HardDrive, color: 'text-amber-500' },
];

const toolsItems = [
  { title: 'VPS Generator', url: '/protected/vps-generator', icon: Target, color: 'text-orange-500' },
  { title: 'Prompt Generator', url: '/protected/prompt-generator', icon: Sparkles, color: 'text-pink-700' },
  { title: 'Landing Page Copy', url: '/protected/landing-page-copy', icon: PanelsTopLeft, color: 'text-purple-700' },
  { title: 'Video Transcriber', url: '/protected/video-transcriber', icon: FileText, color: 'text-cyan-600' },
  { title: 'Video Downloader', url: '/protected/video-downloader', icon: Download, color: 'text-orange-500' },
  { title: 'Website Audit', url: '/protected/website-audit', icon: Eye, color: 'text-green-600' },
];

const adsItems = [
  { title: 'Static Ads Generator', url: '/protected/static-ads-generator', icon: Megaphone, color: 'text-orange-500' },
  { title: 'Video Ads Script Generator', url: '/protected/video-ads-script-generator', icon: ScrollText, color: 'text-orange-500' },
];

const contentCreationItems = [
  { title: 'Persona Generator', url: '/protected/persona-generator', icon: Users, color: 'text-orange-500' },
  { title: 'Reel Paraphraser', url: '/protected/reel-paraphraser', icon: Video, color: 'text-orange-500' },
  { title: 'Reel Script Generator V2', url: '/protected/reel-script-generator-v2', icon: ScrollText, color: 'text-orange-500' },
  { title: 'Looping and Carousel Copy', url: '/protected/looping-and-carousel-copy', icon: Repeat, color: 'text-orange-500' },
  { title: 'Pinned Highlights Script Generator', url: '/protected/pinned-highlights-script-generator', icon: UserPlus, color: 'text-orange-500' },
  { title: 'Caption Generator', url: '/protected/caption-generator', icon: Type, color: 'text-orange-500' },
  { title: 'Caption Paraphraser', url: '/protected/caption-paraphraser', icon: MessageSquareText, color: 'text-orange-500' },
  { title: 'Thumbnail Hooks', url: '/protected/thumbnail-hooks', icon: Image, color: 'text-orange-500' },
  { title: 'Audio Tags', url: '/protected/audio-tags', icon: Music, color: 'text-orange-500' },
];

const aiAvatarItems = [
  { title: 'Reel to Prompt V3', url: '/protected/reel-to-prompt-v3', icon: Sparkles, color: 'text-indigo-500' },
  { title: 'Assets Generator', url: '/protected/assets-generator', icon: Package, color: 'text-indigo-500' },
  { title: '2S - Reel to Prompt', url: '/protected/2s-reel-to-prompt', icon: Infinity, color: 'text-indigo-500' },
  { title: 'Photoshoot to Prompt', url: '/protected/photoshoot-to-prompt', icon: Shirt, color: 'text-indigo-500' },
  { title: 'Scene Image to Prompt', url: '/protected/scene-to-prompt', icon: Camera, color: 'text-indigo-500' },
  { title: 'Scene Text to Prompt', url: '/protected/scene-text-to-prompt', icon: TextCursorInput, color: 'text-indigo-500' },
  { title: 'Avatar Generator', url: '/protected/avatar-generator', icon: CircleUser, color: 'text-indigo-500' },
  { title: 'Face Analyzer', url: '/protected/face-analyzer', icon: BarChart3, color: 'text-indigo-500' },
  { title: 'Body Analyzer', url: '/protected/body-analyzer', icon: BarChart3, color: 'text-indigo-500' },
  { title: 'Tag Generator & Scene Analyzer', url: '/protected/tag-generator-scene-analyzer', icon: Upload, color: 'text-indigo-500' },
  { title: 'Poses Generator', url: '/protected/poses-generator', icon: Package, color: 'text-indigo-500' },
  { title: 'Package Generator', url: '/protected/package-generator', icon: Package, color: 'text-indigo-500' },
  { title: 'Reel Scenes Extractor', url: '/protected/reel-scenes-extractor', icon: ImagePlus, color: 'text-indigo-500' },
];

const generationItems = [
  { title: 'Gemini Video Generator', url: '/protected/gemini-video-generator', icon: Video, color: 'text-purple-500' },
  { title: 'Seedance Video Generator', url: '/protected/seedance-video-generator', icon: Video, color: 'text-purple-500' },
  { title: 'Motion Control', url: '/protected/motion-control', icon: Move, color: 'text-purple-500' },
  { title: 'Kling', url: '/protected/kling', icon: Wand2, color: 'text-indigo-500' },
];

const oldItems = [
  { title: 'QA Listing', url: '/protected/qa-listing', icon: FileText, color: 'text-purple-500' },
  { title: 'Reel to Prompt', url: '/protected/reel-to-prompt', icon: Film, color: 'text-purple-500' },
  { title: 'Fashion Randomizer', url: '/protected/fashion-randomizer', icon: Shirt, color: 'text-purple-500' },
  { title: 'B-roll Scene to prompt v2', url: '/protected/b-roll-image-to-prompt', icon: ImagePlus, color: 'text-purple-500' },
  { title: 'Static Ads Copy Generator', url: '/protected/ads-copy', icon: Megaphone, color: 'text-orange-500' },
  { title: 'Reel Scenes Library', url: '/protected/reel-scenes-library', icon: Upload, color: 'text-indigo-500' },
  { title: 'Reel Script Generator', url: '/protected/reel-script-generator', icon: ScrollText, color: 'text-orange-500' },
  { title: 'Time Tracker', url: '/protected/time-entry', icon: Clock, color: 'text-pink-600' },
  { title: 'DM Reply Generator', url: '/protected/dm-reply-generator', icon: Sparkles, color: 'text-purple-500' },
];

interface SidebarProps {
  collapsed: boolean;
}

// ─── UI Helpers ───────────────────────────────────────────────────────────────

const ROW_BASE =
  'flex items-center overflow-hidden rounded-md outline-none transition-colors hover:bg-[hsl(240,3.7%,15.9%)] hover:text-[hsl(240,4.8%,95.9%)] text-[hsl(240,4.8%,95.9%)]';

function VipRow({
  icon: Icon,
  iconClass,
  label,
  labelClass,
  children,
  collapsed,
}: {
  icon: LucideIcon;
  iconClass: string;
  label: string;
  labelClass?: string;
  children: React.ReactNode;
  collapsed: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <li className="list-none">
      <button
        onClick={() => { if (!collapsed) setOpen(!open); }}
        className={`${ROW_BASE} ${collapsed ? 'justify-center size-8 p-0 w-full' : 'w-full gap-2 p-2 text-left text-sm'}`}
        title={collapsed ? label : undefined}
      >
        <Icon className={`size-4 shrink-0 ${iconClass}`} />
        {!collapsed && <span className={`flex-1 truncate ${labelClass ?? ''}`}>{label}</span>}
        {!collapsed && (
          <ChevronRight
            className={`ml-auto size-4 shrink-0 text-[hsl(240,5.3%,26.1%)] transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
          />
        )}
      </button>
      {open && !collapsed && (
        <ul className="ml-4 border-l border-[hsl(240,3.7%,15.9%)] pl-2 mt-0.5 space-y-px">
          {children}
        </ul>
      )}
    </li>
  );
}

function VipItem({
  url,
  icon: Icon,
  iconClass,
  title,
}: {
  url: string;
  icon: LucideIcon;
  iconClass: string;
  title: string;
}) {
  return (
    <li className="list-none">
      <a
        href={`${VIPSCALE_BASE}${url}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 overflow-hidden rounded-md px-2 py-1.5 text-sm text-[hsl(240,4.8%,95.9%)] outline-none transition-colors hover:bg-[hsl(240,3.7%,15.9%)]"
      >
        <Icon className={`size-4 shrink-0 ${iconClass}`} />
        <span className="truncate">{title}</span>
      </a>
    </li>
  );
}

function GroupLabel({ children, collapsed }: { children: React.ReactNode; collapsed: boolean }) {
  if (collapsed) return null;
  return (
    <div className="flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium text-[hsl(0,0%,63.9%)]">
      {children}
    </div>
  );
}

// ─── Main Sidebar Component ───────────────────────────────────────────────────

export function Sidebar({ collapsed }: SidebarProps) {
  const { theme, setTheme } = useAppStore();

  const handleSignOut = () => {
    window.location.href = '/auth/login';
  };

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  const btnClass = (c: boolean) =>
    `flex items-center overflow-hidden rounded-md outline-none transition-colors hover:bg-[hsl(240,3.7%,15.9%)] text-[hsl(240,4.8%,95.9%)] ${c ? 'justify-center size-8 p-0 w-full mx-auto' : 'w-full gap-2 p-2 text-sm'}`;

  return (
    <div className="flex h-full min-h-0 shrink-0 z-20">
      <div
        className="relative h-full min-h-0 flex flex-col transition-all duration-300 ease-in-out"
        style={{ width: collapsed ? '3rem' : '16rem' }}
      >
        <div className="h-full min-h-0 w-full bg-[hsl(240,5.9%,10%)] border-r border-[hsl(240,3.7%,15.9%)] flex flex-col text-[hsl(240,4.8%,95.9%)] overflow-hidden">

          {/* ── Header: VIPScale logo → external link ── */}
          <div className="flex h-[60px] items-center px-2 shrink-0 border-b border-[hsl(240,3.7%,15.9%)]">
            <a
              href="https://tools.vipscaleph.com/protected"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 overflow-hidden flex-1 rounded-md outline-none"
              title="VIPScale"
            >
              <div className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 shadow-lg shadow-purple-500/20">
                <Sparkles className="size-4 text-white" />
              </div>
              {!collapsed && (
                <span className="font-bold text-lg bg-gradient-to-r from-purple-400 to-pink-600 text-transparent bg-clip-text truncate">
                  VIP Scale
                </span>
              )}
            </a>
          </div>

          {/* ── Scrollable content (hidden scrollbar) ── */}
          <div
            className="flex-1 overflow-y-auto overflow-x-hidden min-h-0"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}
          >
            {/* webkit hidden scrollbar via inline style tag */}
            <style>{`.sidebar-scroll::-webkit-scrollbar { display: none; }`}</style>

            {/* Management group */}
            <div className={`px-2 py-2 ${collapsed ? 'flex flex-col items-center gap-1' : ''}`}>
              <GroupLabel collapsed={collapsed}>Management</GroupLabel>
              <ul className={`space-y-px w-full ${collapsed ? 'flex flex-col items-center gap-1' : ''}`}>
                <VipRow icon={Rocket} iconClass="text-sky-500" label="Management" collapsed={collapsed}>
                  {managementItems.map((item) => (
                    <VipItem key={item.title} {...item} iconClass={item.color} />
                  ))}
                </VipRow>
                <VipRow icon={Clock} iconClass="text-pink-600" label="Tracker" collapsed={collapsed}>
                  {trackerItems.map((item) => (
                    <VipItem key={item.title} {...item} iconClass={item.color} />
                  ))}
                </VipRow>
                <VipRow icon={Users} iconClass="text-purple-500" label="Client" collapsed={collapsed}>
                  {clientItems.map((item) => (
                    <VipItem key={item.title} {...item} iconClass={item.color} />
                  ))}
                </VipRow>
                <VipRow icon={ScrollText} iconClass="text-amber-500" label="Contracts" collapsed={collapsed}>
                  {contractsItems.map((item) => (
                    <VipItem key={item.title} {...item} iconClass={item.color} />
                  ))}
                </VipRow>
              </ul>
            </div>

            {/* Marketing group */}
            <div className={`px-2 py-2 ${collapsed ? 'flex flex-col items-center gap-1' : ''}`}>
              <GroupLabel collapsed={collapsed}>Marketing</GroupLabel>
              <ul className={`space-y-px w-full ${collapsed ? 'flex flex-col items-center gap-1' : ''}`}>
                <VipRow icon={Sparkles} iconClass="text-pink-500" label="Tools" collapsed={collapsed}>
                  {toolsItems.map((item) => (
                    <VipItem key={item.title} {...item} iconClass={item.color} />
                  ))}
                </VipRow>
                <VipRow icon={Megaphone} iconClass="text-orange-500" label="Ads" collapsed={collapsed}>
                  {adsItems.map((item) => (
                    <VipItem key={item.title} {...item} iconClass={item.color} />
                  ))}
                </VipRow>
                <VipRow icon={Video} iconClass="text-orange-500" label="Content Creation" collapsed={collapsed}>
                  {contentCreationItems.map((item) => (
                    <VipItem key={item.title} {...item} iconClass={item.color} />
                  ))}
                </VipRow>
              </ul>
            </div>

            {/* AI Production group */}
            <div className={`px-2 py-2 ${collapsed ? 'flex flex-col items-center gap-1' : ''}`}>
              <GroupLabel collapsed={collapsed}>AI Production</GroupLabel>
              <ul className={`space-y-px w-full ${collapsed ? 'flex flex-col items-center gap-1' : ''}`}>
                <VipRow icon={CircleUser} iconClass="text-indigo-500" label="AI Avatar" collapsed={collapsed}>
                  {aiAvatarItems.map((item) => (
                    <VipItem key={item.title} {...item} iconClass={item.color} />
                  ))}
                </VipRow>
                <VipRow icon={Wand2} iconClass="text-purple-500" label="Generation" collapsed={collapsed}>
                  {generationItems.map((item) => (
                    <VipItem key={item.title} {...item} iconClass={item.color} />
                  ))}
                </VipRow>
              </ul>
            </div>

            {/* Others group */}
            <div className={`px-2 py-2 ${collapsed ? 'flex flex-col items-center gap-1' : ''}`}>
              <GroupLabel collapsed={collapsed}>Others</GroupLabel>
              <ul className={`space-y-px w-full ${collapsed ? 'flex flex-col items-center gap-1' : ''}`}>
                <VipRow icon={Archive} iconClass="text-purple-500" label="OLD" labelClass="text-purple-400" collapsed={collapsed}>
                  {oldItems.map((item) => (
                    <VipItem key={item.title} {...item} iconClass={item.color} />
                  ))}
                </VipRow>
              </ul>
            </div>
          </div>

          {/* ── Footer (no border-t separator) ── */}
          <div className={`px-2 py-2 shrink-0 space-y-px flex flex-col ${collapsed ? 'items-center' : ''}`}>

            {/* DM Agent — active/highlighted (this app), no link */}
            <div
              className={`flex items-center overflow-hidden rounded-md bg-fuchsia-500/10 ring-1 ring-fuchsia-500/30 font-medium cursor-default ${collapsed ? 'justify-center size-8 p-0 w-full mx-auto' : 'w-full gap-2 p-2 text-sm'}`}
              title={collapsed ? 'DM Agent' : undefined}
            >
              <Bot className="size-4 shrink-0 text-fuchsia-500" style={{ fill: 'currentColor' }} />
              {!collapsed && <span className="flex-1 truncate text-fuchsia-400">DM Agent</span>}
            </div>

            {/* Nexus — external link */}
            <a
              href="https://nexus.vipscaleph.com"
              target="_blank"
              rel="noopener noreferrer"
              title={collapsed ? 'Nexus' : undefined}
              className={btnClass(collapsed)}
            >
              <div className="size-4 shrink-0 bg-indigo-500 text-white flex items-center justify-center rounded font-bold text-[10px]">
                N
              </div>
              {!collapsed && <span className="truncate">Nexus</span>}
            </a>

            {/* Toggle Theme */}
            <button
              onClick={toggleTheme}
              title={collapsed ? 'Toggle Theme' : undefined}
              className={btnClass(collapsed)}
            >
              {theme === 'dark' ? (
                <Moon className="size-4 shrink-0 text-purple-400" />
              ) : (
                <Sun className="size-4 shrink-0 text-orange-500" />
              )}
              {!collapsed && <span>Toggle Theme</span>}
            </button>

            {/* Sign Out */}
            <button
              onClick={handleSignOut}
              title={collapsed ? 'Sign Out' : undefined}
              className={btnClass(collapsed)}
            >
              <LogOut className="size-4 shrink-0 text-red-500" />
              {!collapsed && <span>Sign Out</span>}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}