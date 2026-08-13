'use client';

import { Button } from '@op/sense/Button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@op/sense/Dialog';
import type { ReactNode } from 'react';

import { useTranslations } from '@/lib/i18n';

interface SelectionConfirmShellProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  triggerDisabled: boolean;
  triggerLabel: ReactNode;
  headerLabel: string;
  confirmLabel: string;
  isSubmitting: boolean;
  onConfirm: () => void;
  children: ReactNode;
}

/**
 * Common scaffold for the manual-selection confirm dialogs: trigger button in
 * the footer bar plus a modal with header / body / footer slots. Body content
 * is variant-specific and supplied as children.
 */
export const SelectionConfirmShell = ({
  isOpen,
  onOpenChange,
  triggerDisabled,
  triggerLabel,
  headerLabel,
  confirmLabel,
  isSubmitting,
  onConfirm,
  children,
}: SelectionConfirmShellProps) => {
  const t = useTranslations();

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger
        render={<Button disabled={triggerDisabled}>{triggerLabel}</Button>}
      />

      {/* 32rem — the sense default (sm:max-w-sm) is narrower than these
          lists need. */}
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{headerLabel}</DialogTitle>
        </DialogHeader>
        <div className="px-6 py-4">{children}</div>
        <DialogFooter>
          <Button
            className="w-full"
            onClick={onConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting ? t('Submitting...') : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
