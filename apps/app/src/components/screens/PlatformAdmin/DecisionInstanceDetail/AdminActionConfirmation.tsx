'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@op/sense/AlertDialog';
import { Button } from '@op/sense/Button';
import type { ComponentProps, ReactNode } from 'react';

import { useTranslations } from '@/lib/i18n';

type ButtonVariant = ComponentProps<typeof Button>['variant'];

/**
 * Confirmation shell for the platform-admin actions in this drill-down. Each
 * action owns its own mutation and copy; this owns the dialog, the cancel
 * affordance, and keeping both controls disabled while the mutation is in
 * flight.
 */
export const AdminActionConfirmation = ({
  triggerLabel,
  triggerIcon,
  triggerVariant,
  title,
  description,
  confirmLabel,
  pendingLabel,
  confirmVariant,
  isPending,
  isOpen,
  onOpenChange,
  onConfirm,
}: {
  triggerLabel: string;
  triggerIcon: ReactNode;
  triggerVariant: ButtonVariant;
  title: string;
  description: string;
  confirmLabel: string;
  /** Replaces `confirmLabel` while the mutation runs. */
  pendingLabel: string;
  confirmVariant: ButtonVariant;
  isPending: boolean;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onConfirm: () => void;
}) => {
  const t = useTranslations();

  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogTrigger
        render={<Button variant={triggerVariant} size="sm" />}
      >
        {triggerIcon}
        {triggerLabel}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>
            {t('Cancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            variant={confirmVariant}
            disabled={isPending}
            onClick={onConfirm}
          >
            {isPending ? pendingLabel : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
