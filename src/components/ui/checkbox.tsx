import * as React from 'react';
import { cn } from '@/lib/utils';

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  hint?: string;
  size?: 'sm' | 'md';
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, hint, size = 'sm', id, ...props }, ref) => {
    const generatedId = React.useId();
    const inputId = id || generatedId;
    return (
      <label htmlFor={inputId} className={cn('muri-checkbox', `muri-checkbox-${size}`, className)}>
        <input ref={ref} id={inputId} type="checkbox" {...props} />
        <span className="muri-checkbox-copy">
          {label && <span className="muri-checkbox-label">{label}</span>}
          {hint && <span className="muri-checkbox-hint">{hint}</span>}
        </span>
      </label>
    );
  },
);
Checkbox.displayName = 'Checkbox';
