'use client';

import { ProposalStatus } from '@op/api/encoders';
import type { Proposal } from '@op/common/client';
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
import { type ReactNode, useState } from 'react';
import { LuCheck, LuEllipsis, LuEye, LuEyeOff, LuX } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { useProposalModerationActions } from './useProposalModerationActions';

interface AdminMenuItem {
  key: string;
  icon: ReactNode;
  label: string;
  onAction: () => void;
  isDisabled: boolean;
}

/**
 * Admin overflow menu (`…`) for the proposal page's action row: shortlist /
 * reject from shortlist / hide-unhide. Mirrors the browse-card kebab
 * (`ProposalCard/ProposalCardMenu`) and shares its mutations + toast copy via
 * {@link useProposalModerationActions}, so the two surfaces can't drift.
 *
 * Renders nothing unless the viewer has decision-admin access and the proposal
 * has left draft. Delete is deliberately absent — deleting the proposal you're
 * reading belongs on the card surface, and the Figma menu omits it here.
 *
 * On mobile the menu is a bottom sheet, matching Figma 18727:28989.
 */
export function ProposalAdminMenu({ proposal }: { proposal: Proposal }) {
  const t = useTranslations();
  const isMobile = useMediaQuery(`(max-width: ${screens.sm})`);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const {
    approve,
    reject,
    toggleVisibility,
    isHidden,
    isShortlisted,
    isRejected,
    isLoading,
  } = useProposalModerationActions(proposal);

  const canModerate =
    proposal.access?.admin === true && proposal.status !== ProposalStatus.DRAFT;

  if (!canModerate) {
    return null;
  }

  const triggerLabel = t('Proposal options');

  const runAndClose = (action: () => void) => () => {
    action();
    setIsSheetOpen(false);
  };

  // Figma separates the shortlisting actions from the visibility action.
  const shortlistItems: AdminMenuItem[] = [
    {
      key: 'approve',
      icon: <LuCheck className="size-5" />,
      label: t('Shortlist for voting'),
      onAction: runAndClose(approve),
      isDisabled: isLoading || isShortlisted,
    },
    {
      key: 'reject',
      icon: <LuX className="size-5" />,
      label: t('Reject from shortlist'),
      onAction: runAndClose(reject),
      isDisabled: isLoading || isRejected,
    },
  ];

  const visibilityItems: AdminMenuItem[] = [
    {
      key: 'visibility',
      icon: isHidden ? (
        <LuEye className="size-5" />
      ) : (
        <LuEyeOff className="size-5" />
      ),
      label: isHidden ? t('Unhide proposal') : t('Hide proposal'),
      onAction: runAndClose(toggleVisibility),
      isDisabled: isLoading,
    },
  ];

  const items = [...shortlistItems, ...visibilityItems];

  if (isMobile) {
    return (
      <>
        <Button
          aria-label={triggerLabel}
          variant="outline"
          size="icon"
          onClick={() => setIsSheetOpen(true)}
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
              <SheetTitle>{triggerLabel}</SheetTitle>
            </SheetHeader>
            <div className="pb-safe flex min-w-full flex-col">
              {items.map((item, index) => (
                <Button
                  key={item.key}
                  variant="ghost"
                  onClick={item.onAction}
                  disabled={item.isDisabled}
                  className={cn(
                    'h-auto w-full justify-start gap-2 rounded-none px-6 py-4',
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
      </>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label={triggerLabel}
            variant="outline"
            size="icon"
            className="aria-expanded:bg-muted"
          >
            <LuEllipsis className="size-4" />
          </Button>
        }
      />
      <DropdownMenuContent side="bottom" align="end" className="p-2">
        {/* Two groups so the separator sits between them rather than inside a
            single `role="group"`. */}
        <DropdownMenuGroup>
          {shortlistItems.map((item) => (
            <AdminMenuDropdownItem key={item.key} item={item} />
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {visibilityItems.map((item) => (
            <AdminMenuDropdownItem key={item.key} item={item} />
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AdminMenuDropdownItem({ item }: { item: AdminMenuItem }) {
  return (
    <DropdownMenuItem
      onClick={item.onAction}
      disabled={item.isDisabled}
      className="min-w-48"
    >
      {item.icon}
      {item.label}
    </DropdownMenuItem>
  );
}
