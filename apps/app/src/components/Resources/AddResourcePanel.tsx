'use client';

import { Button } from '@op/ui/Button';
import { ButtonGroup } from '@op/ui/ButtonGroup';
import { IconButton } from '@op/ui/IconButton';
import { useState } from 'react';
import { LuFile, LuLink, LuX } from 'react-icons/lu';

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
        <IconButton
          variant="ghost"
          size="small"
          onPress={onClose}
          aria-label={t('Close')}
        >
          <LuX className="size-4" />
        </IconButton>
      </div>
      <div className="shrink-0 px-4 pt-4 sm:px-6">
        <ButtonGroup className="w-full" aria-label={t('Resource type')}>
          <Button
            color="secondary"
            size="small"
            aria-pressed={kind === 'link'}
            onPress={() => setKind('link')}
            className="flex-1"
          >
            <LuLink className="size-4" />
            {t('Link')}
          </Button>
          <Button
            color="secondary"
            size="small"
            aria-pressed={kind === 'document'}
            onPress={() => setKind('document')}
            className="flex-1"
          >
            <LuFile className="size-4" />
            {t('Document')}
          </Button>
        </ButtonGroup>
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
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
    </div>
  );
};
