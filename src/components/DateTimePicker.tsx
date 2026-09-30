"use client"

import * as React from "react"
import { Popover } from "@base-ui/react/popover"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

// Value is local wall-clock time as "YYYY-MM-DDTHH:mm" (same format a datetime-local input uses)
const pad = (n: number) => String(n).padStart(2, "0")
export function toLocalDateTimeValue(date: Date | string) {
  const d = new Date(date)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// Hour : minute boxes + AM/PM toggle. Shared by the timeline picker and the "Message Sent At" dialog.
export function TimeFields({ hour12, minute, pm, onChange, size = "sm" }: {
  hour12: number
  minute: number
  pm: boolean
  onChange: (hour12: number, minute: number, pm: boolean) => void
  size?: "sm" | "default"
}) {
  // While a box is being typed in, its raw text is shown so "0" or "" don't snap back mid-typing
  const [hourText, setHourText] = React.useState<string | null>(null)
  const [minuteText, setMinuteText] = React.useState<string | null>(null)
  const h = size === "sm" ? "h-8" : "h-10"
  const boxClass = `${size === "sm" ? "w-12" : "w-16"} ${h} text-center`

  return (
    <div className="flex items-center justify-center gap-2">
      <Input
        inputMode="numeric"
        aria-label="Hour"
        className={boxClass}
        value={hourText ?? String(hour12)}
        onChange={(e) => {
          const v = e.target.value.replace(/\D/g, "").slice(0, 2)
          setHourText(v)
          const n = parseInt(v, 10)
          if (n >= 1 && n <= 12) onChange(n, minute, pm)
        }}
        onBlur={() => setHourText(null)}
      />
      <span className="font-bold">:</span>
      <Input
        inputMode="numeric"
        aria-label="Minute"
        className={boxClass}
        value={minuteText ?? pad(minute)}
        onChange={(e) => {
          const v = e.target.value.replace(/\D/g, "").slice(0, 2)
          setMinuteText(v)
          const n = parseInt(v, 10)
          if (v !== "" && n >= 0 && n <= 59) onChange(hour12, n, pm)
        }}
        onBlur={() => setMinuteText(null)}
      />
      <div className="flex rounded-md border border-input overflow-hidden ml-1">
        {(["AM", "PM"] as const).map((p) => (
          <Button
            key={p}
            type="button"
            size="sm"
            variant={(p === "PM") === pm ? "default" : "ghost"}
            className={`${h} rounded-none px-3 text-xs`}
            onClick={() => onChange(hour12, minute, p === "PM")}
          >
            {p}
          </Button>
        ))}
      </div>
    </div>
  )
}

export function DateTimePicker({ value, onChange, title }: { value: string; onChange: (value: string) => void; title?: string }) {
  const current = new Date(value)
  const hours12 = current.getHours() % 12 || 12
  const isPm = current.getHours() >= 12

  const emit = (date: Date, h12: number, minute: number, pm: boolean) => {
    const next = new Date(date)
    next.setHours((h12 % 12) + (pm ? 12 : 0), minute, 0, 0)
    onChange(toLocalDateTimeValue(next))
  }

  const label = current.toLocaleString([], { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })

  return (
    <Popover.Root>
      <Popover.Trigger
        className="inline-flex items-center gap-1 text-xs text-muted-foreground rounded px-1.5 py-0.5 border border-transparent hover:border-input hover:text-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors"
        title={title}
      >
        <span className="material-symbols-sharp text-[0.95rem]">schedule</span>
        {label}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner className="isolate z-[60] outline-none" side="bottom" align="start" sideOffset={4}>
          <Popover.Popup className="rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 p-2 outline-none">
            <Calendar
              mode="single"
              selected={current}
              defaultMonth={current}
              onSelect={(date) => date && emit(date, hours12, current.getMinutes(), isPm)}
            />
            <div className="border-t border-border pt-2 pb-1">
              <TimeFields
                hour12={hours12}
                minute={current.getMinutes()}
                pm={isPm}
                onChange={(h12, m, pm) => emit(current, h12, m, pm)}
              />
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
