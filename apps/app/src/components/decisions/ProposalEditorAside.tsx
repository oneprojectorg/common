'use client';

import { useMediaQuery } from '@op/hooks';
import { Button } from '@op/sense/Button';
import { Drawer, DrawerContent, DrawerTitle } from '@op/sense/Drawer';
import { Sheet, SheetContent, SheetTitle } from '@op/sense/Sheet';
import { Skeleton } from '@op/sense/Skeleton';
import { cn } from '@op/sense/lib/utils';
import { screens } from '@op/styles/constants';
import type { ReactNode } from 'react';
import { LuX } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

interface ProposalEditorAsideProps {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  bodyClassName?: string;
}

interface ProposalEditorAsideSkeletonProps {
  children: ReactNode;
  bodyClassName?: string;
}

/**
 * Responsive editor aside shell: a right-side sheet on desktop and a bottom
 * drawer on mobile (Figma "Sheet" instance, 384 wide, header/body padding 24).
 *
 * The desktop sheet is **non-modal** — it sits beside the document rather than
 * over it, so a version can be previewed and scrolled while the aside stays
 * open. The mobile drawer stays modal: it covers the viewport anyway, so there
 * is nothing to compare against behind it.
 *
 * Both branches are base-ui dialogs, so Escape and the close button funnel
 * through `onClose`, which owns the URL state.
 */
export function ProposalEditorAside({
  title,
  onClose,
  children,
  bodyClassName,
}: ProposalEditorAsideProps) {
  const isMobile = useMediaQuery(`(max-width: ${screens.sm})`) ?? false;

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
    }
  };

  const body = (
    <div className={cn('min-h-0 flex-1 overflow-y-auto p-6', bodyClassName)}>
      {children}
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open onOpenChange={handleOpenChange} showSwipeHandle>
        <DrawerContent>
          <AsideHeader
            onClose={onClose}
            title={
              <DrawerTitle className="text-title-xs">
                <bdi>{title}</bdi>
              </DrawerTitle>
            }
          />
          {body}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    // Non-modal on desktop: the whole point of the version aside is comparing
    // against the document beside it, so no backdrop, no scroll lock, and no
    // focus trap. `disablePointerDismissal` is what keeps scrolling or clicking
    // the preview from dismissing the sheet — a non-modal base-ui dialog
    // otherwise closes as soon as focus or a pointer press lands outside it.
    // The preview itself is already read-only: previewing a version renders the
    // form through `mode="preview-version"`, which swaps in the Readonly fields.
    <Sheet
      open
      modal={false}
      disablePointerDismissal
      onOpenChange={handleOpenChange}
    >
      <SheetContent side="right" showCloseButton={false} showOverlay={false}>
        <AsideHeader
          onClose={onClose}
          title={
            <SheetTitle className="text-title-xs">
              <bdi>{title}</bdi>
            </SheetTitle>
          }
        />
        {body}
      </SheetContent>
    </Sheet>
  );
}

/**
 * Static placeholder matching the aside's header/body rhythm, for suspense
 * boundaries that render before the aside's data is available.
 */
export function ProposalEditorAsideSkeleton({
  children,
  bodyClassName,
}: ProposalEditorAsideSkeletonProps) {
  return (
    <aside className="flex h-full w-96 shrink-0 flex-col border-s bg-background">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b p-6">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="size-8 rounded-md" />
      </div>
      <div className={cn('min-h-0 flex-1 overflow-y-auto p-6', bodyClassName)}>
        {children}
      </div>
    </aside>
  );
}

function AsideHeader({
  title,
  onClose,
}: {
  title: ReactNode;
  onClose: () => void;
}) {
  const t = useTranslations();

  return (
    <div className="flex shrink-0 items-center justify-between gap-2 border-b p-6">
      {title}
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t('Close')}
        onClick={onClose}
      >
        <LuX className="size-4" />
      </Button>
    </div>
  );
}
