import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonUtilityProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ElementType;
  tooltip: string;
  size?: 'sm' | 'md';
  color?: 'tertiary' | 'primary-destructive';
}

export const ButtonUtility = React.forwardRef<HTMLButtonElement, ButtonUtilityProps>(
  ({ className, icon: Icon, tooltip, size = 'sm', color = 'tertiary', ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      aria-label={tooltip}
      title={tooltip}
      className={cn('muri-utility-button', `muri-utility-button-${size}`, `muri-utility-button-${color}`, className)}
      {...props}
    >
      <Icon aria-hidden="true" />
    </button>
  ),
);
ButtonUtility.displayName = 'ButtonUtility';
