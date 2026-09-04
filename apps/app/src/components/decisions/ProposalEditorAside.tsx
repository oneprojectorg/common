'use client';

import { useMediaQuery } from '@op/hooks';
import { Button } from '@op/sense/Button';
import { useDirection } from '@op/sense/Direction';
import { Drawer, DrawerContent, DrawerTitle } from '@op/sense/Drawer';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@op/sense/Sheet';
import { cn } from '@op/sense/lib/utils';
import { screens } from '@op/styles/constants';
import type { ReactNode } from 'react';
import { LuX } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

interface ProposalEditorAsideProps {
  /**
   * Controlled open state. Keep this mounted and toggle `open` — unmounting
   * the dialog root skips base-ui's exit animation.
   */
  open: boolean;
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  bodyClassName?: string;
}

/**
 * Responsive editor aside shell: an inline-end sheet on desktop and a bottom
 * drawer on mobile (Figma "Sheet" instance, 384 wide, header/body padding 24).
 *
 * The desktop sheet is non-modal so a version can be previewed beside the
 * document; the mobile drawer covers the viewport anyway, so it stays modal.
 * Both are base-ui dialogs, so Escape and the close button funnel through
 * `onClose`, which owns the URL state.
 */
export function ProposalEditorAside({
  open,
  title,
  onClose,
  children,
  bodyClassName,
}: ProposalEditorAsideProps) {
  const isMobile = useMediaQuery(`(max-width: ${screens.sm})`) ?? false;
  // Sheet takes a physical side, but callers reserve the gap beside it with
  // logical padding (`sm:pe-96`) — hardcoding "right" put the panel and its
  // reserved space on opposite edges in Arabic.
  const isRtl = useDirection() === 'rtl';

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
      <Drawer open={open} onOpenChange={handleOpenChange} showSwipeHandle>
        <DrawerContent>
          <AsideHeader
            onClose={onClose}
            title={
              <DrawerTitle className="text-label">
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
    // `disablePointerDismissal`: a non-modal base-ui dialog otherwise closes as
    // soon as a pointer press lands outside it — i.e. on the preview.
    <Sheet
      open={open}
      modal={false}
      disablePointerDismissal
      onOpenChange={handleOpenChange}
    >
      <SheetContent side={isRtl ? 'left' : 'right'} showOverlay={false}>
        <SheetHeader>
          <SheetTitle>
            <bdi>{title}</bdi>
          </SheetTitle>
        </SheetHeader>
        {body}
      </SheetContent>
    </Sheet>
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
