// Kebab-menu composite: ellipsis icon button + dropdown. Built on vanilla
// shadcn DropdownMenu + Button (icon size, ghost variant).

'use client';

import type { ComponentProps, ReactNode } from 'react';
import { LuEllipsis } from 'react-icons/lu';

import { cn } from '../lib/utils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from './Menu';
import { Button } from './ui/button';

export interface OptionMenuProps {
  children: ReactNode;
  className?: string;
  variant?: ComponentProps<typeof Button>['variant'];
  size?: ComponentProps<typeof Button>['size'];
  'aria-label'?: string;
}

export function OptionMenu({
  children,
  className,
  variant = 'ghost',
  size = 'icon-sm',
  'aria-label': ariaLabel,
}: OptionMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label={ariaLabel}
            variant={variant}
            size={size}
            className={cn('aria-expanded:bg-accent', className)}
          >
            <LuEllipsis className="size-4" />
          </Button>
        }
      />
      <DropdownMenuContent align="end">{children}</DropdownMenuContent>
    </DropdownMenu>
  );
}
