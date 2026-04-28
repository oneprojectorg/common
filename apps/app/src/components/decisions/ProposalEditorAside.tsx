'use client';

import { useMediaQuery } from '@op/hooks';
import { screens } from '@op/styles/constants';
import { Header2 } from '@op/ui/Header';
import { Sheet, SheetBody } from '@op/ui/Sheet';
import { cn } from '@op/ui/utils';
import type { ReactNode } from 'react';
import { LuX } from 'react-icons/lu';

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
 * Responsive editor aside shell that renders as a desktop aside and a mobile
 * bottom sheet.
 */
export function ProposalEditorAside({
  title,
  onClose,
  children,
  bodyClassName,
}: ProposalEditorAsideProps) {
  const isMobile = useMediaQuery(`(max-width: ${screens.sm})`) ?? false;

  if (isMobile) {
    return (
      <Sheet
        isOpen={true}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            onClose();
          }
        }}
        side="bottom"
        className="sm:hidden"
      >
        <div className="flex max-h-[85svh] flex-col bg-white">
          <ProposalEditorAsideHeader title={title} onClose={onClose} />
          <SheetBody className={cn('pb-safe', bodyClassName)}>
            {children}
          </SheetBody>
        </div>
      </Sheet>
    );
  }

  return (
    <aside className="flex h-full w-96 shrink-0 flex-col border-s border-neutral-gray1 bg-white">
      <ProposalEditorAsideHeader title={title} onClose={onClose} />
      <div className={cn('flex-1 overflow-y-auto', bodyClassName)}>
        {children}
      </div>
    </aside>
  );
}

/**
 * Responsive skeleton shell for editor asides.
 */
export function ProposalEditorAsideSkeleton({
  children,
  bodyClassName,
}: ProposalEditorAsideSkeletonProps) {
  const bodyClasses = cn('pt-4', bodyClassName);

  return (
    <>
      <aside className="hidden h-full w-96 shrink-0 flex-col border-s border-neutral-gray1 bg-white sm:flex">
        <div className="flex h-editor-topbar shrink-0 items-center justify-between border-b border-neutral-gray1 px-6">
          <div className="h-4 w-36 animate-pulse rounded bg-neutral-gray1" />
          <div className="size-4 animate-pulse rounded bg-neutral-gray1" />
        </div>
        <div className={bodyClasses}>{children}</div>
      </aside>

      <div className="fixed inset-x-0 bottom-0 z-[999999] max-h-[85svh] rounded-t-2xl bg-white shadow-xl sm:hidden">
        <div className="flex h-editor-topbar shrink-0 items-center justify-between border-b border-neutral-gray1 px-6">
          <div className="h-4 w-36 animate-pulse rounded bg-neutral-gray1" />
          <div className="size-4 animate-pulse rounded bg-neutral-gray1" />
        </div>
        <div className={cn('pb-safe', bodyClasses)}>{children}</div>
      </div>
    </>
  );
}

function ProposalEditorAsideHeader({
  title,
  onClose,
}: {
  title: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="flex h-editor-topbar shrink-0 items-center justify-between border-b border-neutral-gray1 px-6">
      <Header2 className="font-serif text-title-sm14">{title}</Header2>
      <button
        onClick={onClose}
        className="cursor-pointer text-neutral-black hover:text-neutral-charcoal"
      >
        <LuX className="size-4" />
      </button>
    </div>
  );
}
