import React from 'react';
import { ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './dropdown-menu';
import { Button } from './button';

const DropdownSelect = ({ value, onChange, options, placeholder = 'Select an option', className = '' }) => {
  const selectedOption = options.find((option) => option.value === value);

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          color="secondary"
          className={`muri-dropdown-select ${className}`}
        >
          <span>{selectedOption?.label || placeholder}</span>
          <ChevronDown className="muri-dropdown-chevron" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="muri-dropdown-content">
        {options.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onSelect={() => onChange({ target: { value: option.value } })}
            className={option.value === value ? 'muri-dropdown-item-selected' : ''}
          >
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default DropdownSelect;
