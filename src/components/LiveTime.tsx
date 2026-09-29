import { useEffect, useState } from 'react';

export function LiveTime({ timezone, label }: { timezone: string | null | undefined, label: string }) {
  const [time, setTime] = useState<string>('');

  useEffect(() => {
    if (!timezone) return;

    const updateTime = () => {
      try {
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: timezone,
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        });
        setTime(formatter.format(new Date()));
      } catch (e) {
        // Invalid timezone
        setTime('');
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 10000); // Update every 10 seconds
    return () => clearInterval(interval);
  }, [timezone]);

  if (!timezone) return null;

  return (
    <span className="text-xs text-muted-foreground flex items-center gap-1">
      <span className="material-symbols-sharp text-[14px]">schedule</span>
      {label}: {timezone.replace(/_/g, ' ')} {time ? `• ${time}` : ''}
    </span>
  );
}
