'use client';

import { useMediaQuery } from '@op/hooks';
import { Button } from '@op/sense/Button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@op/sense/DropdownMenu';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@op/sense/Sheet';
import { cn } from '@op/sense/lib/utils';
import { screens } from '@op/styles/constants';
import { Fragment, type ComponentProps, type ReactNode, useState } from 'react';
import { LuEllipsis } from 'react-icons/lu';

export interface ProposalOptionsMenuItem {
  key: string;
  icon: ReactNode;
  label: string;
  onAction: () => void;
  isDisabled?: boolean;
  isDestructive?: boolean;
}

/**
 * The `…` overflow menu shared by the proposal card and the proposal page: a
 * bottom sheet on mobile (Figma 18727:28989), a dropdown from `sm` up.
 *
 * Both surfaces had this shell copied class-for-class, so a change to one
 * silently diverged from the other. Callers now supply only the items and the
 * trigger's appearance.
 *
 * `groups` renders a separator between each group in the dropdown; the sheet
 * ignores the grouping and rules every row, since a bottom sheet has no
 * separator convention to honour. The sheet closes itself after an action, so
 * callers don't wrap their handlers.
 */
export function ProposalOptionsMenu({
  groups,
  label,
  triggerProps,
  children,
}: {
  groups: ProposalOptionsMenuItem[][];
  /** Accessible name for the trigger, and the sheet's (visually hidden) title. */
  label: string;
  triggerProps?: ComponentProps<typeof Button>;
  /** Dialogs the caller owns (delete confirmation, say). */
  children?: ReactNode;
}) {
  const isMobile = useMediaQuery(`(max-width: ${screens.sm})`);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const items = groups.flat();

  if (items.length === 0) {
    return null;
  }

  if (isMobile) {
    return (
      <>
        <Button
          aria-label={label}
          onClick={() => setIsSheetOpen(true)}
          {...triggerProps}
        >
          <LuEllipsis className="size-4" />
        </Button>
        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
          <SheetContent
            side="bottom"
            showCloseButton={false}
            className="rounded-t-2xl p-0"
          >
            <SheetHeader className="sr-only">
              <SheetTitle>{label}</SheetTitle>
            </SheetHeader>
            <div className="pb-safe flex min-w-full flex-col">
              {items.map((item, index) => (
                <Button
                  key={item.key}
                  variant="ghost"
                  onClick={() => {
                    setIsSheetOpen(false);
                    item.onAction();
                  }}
                  disabled={item.isDisabled}
                  className={cn(
                    'h-auto w-full justify-start gap-2 rounded-none px-6 py-4',
                    item.isDestructive && 'text-destructive',
                    index < items.length - 1 && 'border-b border-border',
                  )}
                >
                  {item.icon}
                  {item.label}
                </Button>
              ))}
            </div>
          </SheetContent>
        </Sheet>
        {children}
      </>
    );
  }

  return (
    <>
      <DropdownMenu>
        {/* No `aria-expanded` styling here: the `ghost` and `outline` variants
            already carry it. */}
        <DropdownMenuTrigger
          render={
            <Button aria-label={label} {...triggerProps}>
              <LuEllipsis className="size-4" />
            </Button>
          }
        />
        <DropdownMenuContent side="bottom" align="end" className="p-2">
          {groups.map((group, groupIndex) => (
            <Fragment key={group[0]?.key ?? groupIndex}>
              {groupIndex > 0 && <DropdownMenuSeparator />}
              {/* A group per set, so a separator sits between them rather than
                  inside one `role="group"`. */}
              <DropdownMenuGroup>
                {group.map((item) => (
                  <DropdownMenuItem
                    key={item.key}
                    onClick={item.onAction}
                    disabled={item.isDisabled}
                    variant={item.isDestructive ? 'destructive' : 'default'}
                    className="min-w-48"
                  >
                    {item.icon}
                    {item.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            </Fragment>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {children}
    </>
  );
}
