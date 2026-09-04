import * as React from 'react';
import { CalendarDays, Clock3 } from 'lucide-react';

export interface CalendarSchedulerProps {
  date?: string;
  time?: string;
  onDateChange: (value: string) => void;
  onTimeChange: (value: string) => void;
}

export function CalendarScheduler({ date = '', time = '', onDateChange, onTimeChange }: CalendarSchedulerProps) {
  return (
    <div className="muri-scheduler">
      <label className="muri-scheduler-field">
        <span><CalendarDays size={15} aria-hidden="true" /> Date</span>
        <input type="date" value={date} onChange={(event) => onDateChange(event.target.value)} />
      </label>
      <label className="muri-scheduler-field">
        <span><Clock3 size={15} aria-hidden="true" /> Time</span>
        <input type="time" value={time} onChange={(event) => onTimeChange(event.target.value)} />
      </label>
    </div>
  );
}
