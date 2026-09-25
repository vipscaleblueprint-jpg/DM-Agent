'use client';

import { useMemo, useState, useRef, useEffect } from 'react';
import { browserTimezone } from '@/lib/followup';
import { ChevronDown, Check, Search } from 'lucide-react';

type Props = {
  id?: string;
  value: string;
  onChange: (tz: string) => void;
};

function offsetLabel(tz: string) {
  try {
    const part = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'shortOffset' })
      .formatToParts(new Date())
      .find(p => p.type === 'timeZoneName');
    return part?.value ?? '';
  } catch {
    return '';
  }
}

export function TimezoneSelect({ id, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const zones = useMemo(() => {
    const all: string[] = (Intl as any).supportedValuesOf?.('timeZone') ?? [];
    return all.map(tz => ({ tz, label: `${tz.replace(/_/g, ' ')} (${offsetLabel(tz)})` }));
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return zones;
    const lower = search.toLowerCase();
    return zones.filter(z => z.label.toLowerCase().includes(lower));
  }, [search, zones]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedLabel = useMemo(() => {
    if (!value) return `Not set (uses my timezone: ${browserTimezone()})`;
    return zones.find(z => z.tz === value)?.label || value;
  }, [value, zones]);

  return (
    <div className="relative w-full" ref={containerRef} id={id}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm text-left shadow-sm outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors hover:bg-accent/50"
      >
        <span className="truncate flex-1">{selectedLabel}</span>
        <ChevronDown className="h-4 w-4 opacity-50 shrink-0 ml-2" />
      </button>

      {open && (
        <div className="absolute top-full left-0 z-50 w-full mt-1 overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-md animate-in fade-in zoom-in-95 duration-100">
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              autoFocus
              type="text"
              className="flex h-10 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Search timezone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="max-h-60 overflow-y-auto p-1">
            <div
              className={`relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none hover:bg-accent hover:text-accent-foreground ${!value ? 'bg-accent/50 text-accent-foreground font-medium' : ''}`}
              onClick={() => {
                onChange('');
                setOpen(false);
                setSearch('');
              }}
            >
              <span className="truncate">Not set (uses my timezone: {browserTimezone()})</span>
              {!value && (
                <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
                  <Check className="h-4 w-4" />
                </span>
              )}
            </div>
            
            {filtered.length === 0 && (
              <div className="py-6 text-center text-sm text-muted-foreground">
                No timezone found.
              </div>
            )}

            {filtered.map(z => (
              <div
                key={z.tz}
                className={`relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none hover:bg-accent hover:text-accent-foreground ${value === z.tz ? 'bg-accent text-accent-foreground font-medium' : ''}`}
                onClick={() => {
                  onChange(z.tz);
                  setOpen(false);
                  setSearch('');
                }}
              >
                <span className="truncate">{z.label}</span>
                {value === z.tz && (
                  <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
                    <Check className="h-4 w-4" />
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
