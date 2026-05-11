'use client';

import { Button } from '@op/ui/Button';
import { Dialog, DialogTrigger } from '@op/ui/Dialog';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@op/ui/Modal';
import type { ReactNode } from 'react';

import { useTranslations } from '@/lib/i18n';

interface SelectionConfirmShellProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  triggerDisabled: boolean;
  triggerLabel: string;
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
    <DialogTrigger isOpen={isOpen} onOpenChange={onOpenChange}>
      <Button isDisabled={triggerDisabled} variant="primary">
        {triggerLabel}
      </Button>

      <Modal isDismissable>
        <Dialog className="h-full">
          <ModalHeader>{headerLabel}</ModalHeader>
          <ModalBody>{children}</ModalBody>
          <ModalFooter>
            <Button
              className="w-full"
              color="primary"
              onPress={onConfirm}
              isDisabled={isSubmitting}
            >
              {isSubmitting ? t('Submitting...') : confirmLabel}
            </Button>
          </ModalFooter>
        </Dialog>
      </Modal>
    </DialogTrigger>
  );
};
