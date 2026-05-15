// Compatibility wrapper for @op/ui's OptionMenu — the standard "kebab menu"
// (ellipsis icon button + dropdown). Wraps shadcn DropdownMenu.
//
// Usage:
//   <OptionMenu aria-label="Row actions">
//     <DropdownMenuItem onClick={...}>Edit</DropdownMenuItem>
//     <DropdownMenuSeparator />
//     <DropdownMenuItem onClick={...}>Delete</DropdownMenuItem>
//   </OptionMenu>

'use client';

import type { ReactNode } from 'react';
import { LuEllipsis } from 'react-icons/lu';

import { cn } from '../lib/utils';
import { IconButton } from './IconButton';
import type { IconButtonProps } from './IconButton';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from './Menu';

export interface OptionMenuProps {
  children: ReactNode;
  className?: string;
  variant?: IconButtonProps['variant'];
  size?: IconButtonProps['size'];
  'aria-label'?: string;
}

export function OptionMenu({
  children,
  className,
  variant = 'ghost',
  size = 'small',
  'aria-label': ariaLabel,
}: OptionMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <IconButton
            aria-label={ariaLabel}
            variant={variant}
            size={size}
            className={cn('aria-expanded:bg-accent', className)}
          >
            <LuEllipsis className="size-4" />
          </IconButton>
        }
      />
      <DropdownMenuContent align="end">{children}</DropdownMenuContent>
    </DropdownMenu>
  );
}
