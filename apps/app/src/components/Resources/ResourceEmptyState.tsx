'use client';

import { EmptyState } from '@op/ui/EmptyState';
import { LuFolderOpen, LuLock } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

type Variant = 'admin-empty' | 'member-empty' | 'no-access';

export const ResourceEmptyState = ({ variant }: { variant: Variant }) => {
  const t = useTranslations();

  if (variant === 'no-access') {
    return (
      <EmptyState icon={<LuLock />}>
        {t("You don't have access to resources for this decision.")}
      </EmptyState>
    );
  }

  if (variant === 'admin-empty') {
    return (
      <EmptyState icon={<LuFolderOpen />}>
        <p className="text-sm">{t('No resources yet')}</p>
        <p className="text-sm text-neutral-gray4">
          {t('Add your first resource')}
        </p>
      </EmptyState>
    );
  }

  return (
    <EmptyState icon={<LuFolderOpen />}>{t('No resources yet')}</EmptyState>
  );
};
