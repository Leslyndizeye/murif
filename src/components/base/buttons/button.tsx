import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  color?: 'primary' | 'secondary' | 'primary-destructive';
  iconLeading?: React.ElementType;
  iconTrailing?: React.ElementType;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, color, iconLeading: IconLeading, iconTrailing: IconTrailing, asChild = false, children, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    const colorClass = color === 'secondary'
      ? 'border border-[#0C5494] bg-white text-[#0C5494] hover:bg-[#e8f4fc]'
      : color === 'primary-destructive'
        ? 'bg-[#b91c1c] text-white hover:bg-[#991b1b]'
        : color === 'primary'
          ? 'bg-[#0C5494] text-white hover:bg-[#0a4278]'
          : undefined;
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }), colorClass)} ref={ref} {...props}>
        {IconLeading && <IconLeading data-icon="true" aria-hidden="true" />}
        {children}
        {IconTrailing && <IconTrailing data-icon="true" aria-hidden="true" />}
      </Comp>
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
