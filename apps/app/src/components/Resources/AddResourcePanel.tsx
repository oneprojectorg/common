'use client';

import { cn } from '@op/ui/utils';
import { useState } from 'react';
import { LuX } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { AddResourceDocumentForm } from './AddResourceDocumentForm';
import { AddResourceLinkForm } from './AddResourceLinkForm';

type Kind = 'link' | 'document';

export const AddResourcePanel = ({
  profileId,
  onClose,
}: {
  profileId: string;
  onClose: () => void;
}) => {
  const t = useTranslations();
  const [kind, setKind] = useState<Kind>('link');

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-neutral-gray1 px-4 py-3 sm:px-6">
        <span className="font-serif text-title-sm">{t('Add Resource')}</span>
        <button
          type="button"
          aria-label={t('Close')}
          onClick={onClose}
          className="ml-auto flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg outline-none hover:bg-neutral-gray1 focus-visible:ring-2 focus-visible:ring-primary-teal focus-visible:ring-offset-2"
        >
          <LuX className="size-4" />
        </button>
      </div>
      <div className="flex shrink-0 gap-2 px-4 pt-4 sm:px-6">
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
    </div>
  );
};
