'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface DateRangePickerProps {
  onRangeChange: (from?: string, to?: string) => void;
}

const PRESETS = [
  { label: 'Today', days: 0 },
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'All time', days: -1 },
];

export function DateRangePicker({ onRangeChange }: DateRangePickerProps) {
  const [active, setActive] = useState('All time');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const handlePreset = (label: string, days: number) => {
    setActive(label);
    if (days === -1) {
      onRangeChange(undefined, undefined);
      return;
    }
    const to = new Date();
    const from = new Date();
    if (days === 0) {
      from.setHours(0, 0, 0, 0);
    } else {
      from.setDate(from.getDate() - days);
    }
    onRangeChange(from.toISOString(), to.toISOString());
  };

  const handleCustom = () => {
    if (customFrom && customTo) {
      setActive('custom');
      onRangeChange(new Date(customFrom).toISOString(), new Date(customTo).toISOString());
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {PRESETS.map((preset) => (
        <Button
          key={preset.label}
          variant={active === preset.label ? 'default' : 'outline'}
          size="sm"
          onClick={() => handlePreset(preset.label, preset.days)}
        >
          {preset.label}
        </Button>
      ))}
      <div className="hidden sm:flex items-center gap-2 ml-1">
        <Input
          type="date"
          value={customFrom}
          onChange={(e) => setCustomFrom(e.target.value)}
          className="w-auto"
          style={{ colorScheme: 'dark' }}
        />
        <span className="text-muted-foreground text-sm">&rarr;</span>
        <Input
          type="date"
          value={customTo}
          onChange={(e) => setCustomTo(e.target.value)}
          className="w-auto"
          style={{ colorScheme: 'dark' }}
        />
        <Button variant="outline" size="sm" onClick={handleCustom}>
          Apply
        </Button>
      </div>
    </div>
  );
}
