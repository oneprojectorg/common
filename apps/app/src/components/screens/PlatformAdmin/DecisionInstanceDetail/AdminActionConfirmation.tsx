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

export interface AdminActionTrigger {
  label: string;
  icon: ReactNode;
  variant: ButtonVariant;
}

export interface AdminActionConfirm {
  label: string;
  /** Replaces `label` while the mutation runs. */
  pendingLabel: string;
  variant: ButtonVariant;
}

/** Confirmation shell shared by the admin actions in this drill-down. */
export const AdminActionConfirmation = ({
  trigger,
  title,
  description,
  confirm,
  isPending,
  isOpen,
  onOpenChange,
  onConfirm,
  children,
}: {
  trigger: AdminActionTrigger;
  title: string;
  description: string;
  confirm: AdminActionConfirm;
  isPending: boolean;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onConfirm: () => void;
  /** Options the action takes, rendered between the description and footer. */
  children?: ReactNode;
}) => {
  const t = useTranslations();

  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogTrigger
        render={<Button variant={trigger.variant} size="sm" />}
      >
        {trigger.icon}
        {trigger.label}
      </AlertDialogTrigger>
      <AlertDialogContent>
        {/* AlertDialog has no body slot: the header and footer carry their own
            px-6, so body content has to match it or it sits at the card edge.
            The header's pb-8 assumes it is the last thing before the footer. */}
        <AlertDialogHeader className={children ? 'pb-4' : undefined}>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {children ? <div className="px-6 pb-6">{children}</div> : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>
            {t('Cancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            variant={confirm.variant}
            disabled={isPending}
            onClick={onConfirm}
          >
            {isPending ? confirm.pendingLabel : confirm.label}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
