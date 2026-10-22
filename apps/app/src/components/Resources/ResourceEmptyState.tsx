'use client';

import { Button } from '@op/sense/Button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@op/sense/Empty';
import { LuLeaf, LuLock, LuPlus } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

type Variant = 'admin-empty' | 'member-empty' | 'no-access';

export const ResourceEmptyState = ({
  variant,
  onAddResource,
}: {
  variant: Variant;
  onAddResource?: () => void;
}) => {
  const t = useTranslations('resources');

  if (variant === 'no-access') {
    return (
      <Empty className="border-0">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <LuLock />
          </EmptyMedia>
          <EmptyDescription>{t('noAccess')}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <LuLeaf className="size-4" />
        </EmptyMedia>
        <EmptyTitle>{t('emptyTitle')}</EmptyTitle>
        <EmptyDescription className="max-w-72">
          {variant === 'admin-empty'
            ? t('emptyAdminHint')
            : t('emptyParticipantHint')}
        </EmptyDescription>
      </EmptyHeader>
      {variant === 'admin-empty' && onAddResource ? (
        <EmptyContent>
          <Button onClick={onAddResource}>
            <LuPlus className="size-4" />
            {t('addAction')}
          </Button>
        </EmptyContent>
      ) : null}
    </Empty>
  );
};
