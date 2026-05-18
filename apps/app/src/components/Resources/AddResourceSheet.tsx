'use client';

import { Sheet, SheetBody, SheetHeader } from '@op/ui/Sheet';
import { cn } from '@op/ui/utils';
import { useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import { AddResourceDocumentForm } from './AddResourceDocumentForm';
import { AddResourceLinkForm } from './AddResourceLinkForm';

type Kind = 'link' | 'document';

export const AddResourceSheet = ({
  profileId,
  isOpen,
  onClose,
}: {
  profileId: string;
  isOpen: boolean;
  onClose: () => void;
}) => {
  const t = useTranslations();
  const [kind, setKind] = useState<Kind>('link');

  return (
    <Sheet
      side="bottom"
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
      isDismissable
    >
      <SheetHeader onClose={onClose}>{t('Add resource')}</SheetHeader>
      <SheetBody>
        <div className="flex gap-2 px-4 pt-4">
          <button
            type="button"
            onClick={() => setKind('link')}
            className={cn(
              'flex-1 cursor-pointer rounded-full border px-4 py-2 text-sm transition-colors',
              kind === 'link'
                ? 'border-primary-teal bg-primary-tealWhite text-primary-teal'
                : 'border-neutral-gray2 text-neutral-charcoal hover:bg-neutral-gray1',
            )}
          >
            {t('Link')}
          </button>
          <button
            type="button"
            onClick={() => setKind('document')}
            className={cn(
              'flex-1 cursor-pointer rounded-full border px-4 py-2 text-sm transition-colors',
              kind === 'document'
                ? 'border-primary-teal bg-primary-tealWhite text-primary-teal'
                : 'border-neutral-gray2 text-neutral-charcoal hover:bg-neutral-gray1',
            )}
          >
            {t('Document')}
          </button>
        </div>
        {kind === 'link' ? (
          <AddResourceLinkForm
            profileId={profileId}
            onSuccess={onClose}
            onCancel={onClose}
          />
        ) : (
          <AddResourceDocumentForm
            profileId={profileId}
            onSuccess={onClose}
            onCancel={onClose}
          />
        )}
      </SheetBody>
    </Sheet>
  );
};
