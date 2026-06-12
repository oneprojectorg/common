'use client';

import { Button } from '@op/ui/Button';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@op/ui/Modal';
import { useState } from 'react';

import { Link, useRouter, useTranslations } from '@/lib/i18n';

import { useProcessBuilderStore } from '../stores/useProcessBuilderStore';

/**
 * Link that intercepts in-app navigation out of the editor when a
 * published process has unsaved edits, and asks for confirmation.
 * Drafts pass through — their edits autosave.
 */
export function UnsavedExitLink({
  href,
  decisionProfileId,
  isDraft,
  className,
  children,
}: {
  href: string;
  decisionProfileId?: string;
  isDraft: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [isConfirming, setIsConfirming] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    if (isDraft || !decisionProfileId) {
      return;
    }
    const dirty = useProcessBuilderStore.getState().dirty[decisionProfileId];
    if (dirty && Object.keys(dirty).length > 0) {
      e.preventDefault();
      setIsConfirming(true);
    }
  };

  return (
    <>
      <Link href={href} className={className} onClick={handleClick}>
        {children}
      </Link>
      <Modal isOpen={isConfirming} onOpenChange={setIsConfirming} isDismissable>
        <ModalHeader>{t('Unsaved changes')}</ModalHeader>
        <ModalBody>
          <p className="text-neutral-charcoal">
            {t(
              'You have edits that haven’t been published. Use “Update Process” to save them before leaving.',
            )}
          </p>
        </ModalBody>
        <ModalFooter>
          <Button
            color="neutral"
            onPress={() => setIsConfirming(false)}
            className="w-full sm:w-auto"
          >
            {t('Stay')}
          </Button>
          <Button
            onPress={() => {
              setIsConfirming(false);
              router.push(href);
            }}
            className="w-full sm:w-auto"
          >
            {t('Leave anyway')}
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
}
