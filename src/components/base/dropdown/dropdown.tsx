import * as React from 'react';
import {
  Menu,
  MenuItem,
  MenuSection,
  MenuTrigger,
  Popover,
  Separator,
} from 'react-aria-components';
import { cn } from '@/lib/utils';

const Root = MenuTrigger;

const DropdownPopover = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<typeof Popover>
>(({ className, ...props }, ref) => (
  <Popover
    ref={ref}
    offset={6}
    className={cn(
      'z-50 min-w-48 overflow-hidden rounded-md border border-[#dbe5ef] bg-white p-1 text-[#172033] shadow-lg outline-none',
      className
    )}
    {...props}
  />
));
DropdownPopover.displayName = 'DropdownPopover';

const DropdownMenu = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<typeof Menu>
>(({ className, ...props }, ref) => (
  <Menu
    ref={ref}
    className={cn('flex min-w-48 flex-col gap-1 outline-none', className)}
    {...props}
  />
));
DropdownMenu.displayName = 'DropdownMenu';

const DropdownSection = MenuSection;
const DropdownSeparator = Separator;

const DropdownItem = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<typeof MenuItem>
>(({ className, ...props }, ref) => (
  <MenuItem
    ref={ref}
    className={cn(
      'flex cursor-default select-none items-center rounded px-2.5 py-2 text-sm outline-none focus:bg-[#e8f4fc] focus:text-[#0C5494] data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      className
    )}
    {...props}
  />
));
DropdownItem.displayName = 'DropdownItem';

const Dropdown = {
  Root,
  Popover: DropdownPopover,
  Menu: DropdownMenu,
  Section: DropdownSection,
  Separator: DropdownSeparator,
  Item: DropdownItem,
};

export { Dropdown };
