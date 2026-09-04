'use client';

import { Button } from '@op/sense/Button';
import { SidebarTrigger } from '@op/sense/Sidebar';
import { Skeleton } from '@op/sense/Skeleton';
import { cn } from '@op/sense/lib/utils';
import { type ReactNode, useState } from 'react';
import { LuAlignJustify, LuSearch } from 'react-icons/lu';

import ErrorBoundary from '../ErrorBoundary';
import { SearchInput } from '../SearchInput';

/**
 * The interactive half of the site header. It owns `isMobileSearchExpanded`,
 * which has to sit above all three header cells — below md the expanded search
 * takes over the whole bar and hides both the brand and the actions — so the
 * `<header>` element itself is the client boundary.
 *
 * Everything that does not need that state arrives already rendered from the
 * server component in `./index.tsx`: the logo link, the actions tree, and the
 * translated copy. Keep it that way; `SearchInput` in particular carries no
 * `'use client'` of its own and is only valid inside this island.
 *
 * Layout: `gridCentered` 3-column grid on md+ (logo | centered search |
 * actions); a flex row below md (logo ... [search icon + actions]). Below md
 * the search icon expands to a full-width input + Cancel over the whole bar.
 */
export const HeaderShell = ({
  logo,
  actions,
  menuLabel,
  searchLabel,
  cancelLabel,
}: {
  logo: ReactNode;
  actions: ReactNode;
  menuLabel: string;
  searchLabel: string;
  cancelLabel: string;
}) => {
  const [isMobileSearchExpanded, setIsMobileSearchExpanded] = useState(false);

  return (
    <header className="relative z-20 flex h-auto w-full items-center justify-between gap-3 border-b border-border bg-background px-4 py-2 md:grid md:grid-cols-[1fr_auto_1fr] md:px-6">
      <div
        className={cn(
          'flex items-center gap-3',
          isMobileSearchExpanded && 'hidden',
        )}
      >
        <SidebarTrigger
          aria-label={menuLabel}
          className="size-8 rounded-lg md:size-11"
        >
          <LuAlignJustify className="size-4" />
        </SidebarTrigger>
        {logo}
      </div>

      <ErrorBoundary fallback={<Skeleton className="h-11 w-96" />}>
        <div
          className={cn(
            // min-w-0 lets this grid cell shrink below the field's content
            // width so the centered search narrows instead of overflowing.
            'flex min-w-0 items-center',
            isMobileSearchExpanded ? 'w-full' : 'hidden md:flex',
          )}
        >
          <SearchInput />
          <Button
            variant="ghost"
            onClick={() => setIsMobileSearchExpanded(false)}
            className={cn(
              'ms-3 text-muted-foreground',
              !isMobileSearchExpanded && 'hidden',
            )}
          >
            {cancelLabel}
          </Button>
        </div>
      </ErrorBoundary>

      <div
        className={cn(
          'flex items-center gap-2 md:justify-self-end',
          isMobileSearchExpanded && 'hidden',
        )}
      >
        <Button
          variant="outline"
          size="icon"
          onClick={() => setIsMobileSearchExpanded(true)}
          aria-label={searchLabel}
          className="md:hidden"
        >
          <LuSearch className="size-4 text-muted-foreground" />
        </Button>
        {actions}
      </div>
    </header>
  );
};
