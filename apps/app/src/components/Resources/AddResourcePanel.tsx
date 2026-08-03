'use client';

import { Button } from '@op/sense/Button';
import { ButtonGroup } from '@op/sense/ButtonGroup';
import { Header2 } from '@op/sense/Header';
import { useState } from 'react';
import { LuFile, LuLink, LuX } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { AddResourceDocumentForm } from './AddResourceDocumentForm';
import { AddResourceLinkForm } from './AddResourceLinkForm';

type ResourceType = 'link' | 'document';

export const AddResourcePanel = ({
  profileId,
  onClose,
}: {
  profileId: string;
  onClose: () => void;
}) => {
  const t = useTranslations();
  const [selectedResourceType, setSelectedResourceType] =
    useState<ResourceType>('link');

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between px-4 py-3 sm:px-6">
        <Header2 className="font-serif text-title-sm">
          {t('Add Resource')}
        </Header2>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onClose}
          aria-label={t('Close')}
        >
          <LuX className="size-4" />
        </Button>
      </div>
      <div className="shrink-0 px-4 pt-4 sm:px-6">
        {/* TODO(sense-migration): @op/ui ButtonGroup styled the aria-pressed
            selected state; @op/sense ButtonGroup is visual grouping only, so the
            selected look is driven manually via `variant`. Consider migrating to
            @op/sense/ToggleGroup for true segmented-toggle semantics. */}
        <ButtonGroup className="w-full" aria-label={t('Resource type')}>
          <Button
            variant={selectedResourceType === 'link' ? 'default' : 'outline'}
            size="sm"
            aria-pressed={selectedResourceType === 'link'}
            onClick={() => setSelectedResourceType('link')}
            className="flex-1"
          >
            <LuLink className="size-4" />
            {t('Link')}
          </Button>
          <Button
            variant={
              selectedResourceType === 'document' ? 'default' : 'outline'
            }
            size="sm"
            aria-pressed={selectedResourceType === 'document'}
            onClick={() => setSelectedResourceType('document')}
            className="flex-1"
          >
            <LuFile className="size-4" />
            {t('Document')}
          </Button>
        </ButtonGroup>
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        {selectedResourceType === 'link' ? (
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
