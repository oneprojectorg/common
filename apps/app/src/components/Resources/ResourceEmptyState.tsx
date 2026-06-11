'use client';

import { Button } from '@op/ui/Button';
import { EmptyState } from '@op/ui/EmptyState';
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
  const t = useTranslations();

  if (variant === 'no-access') {
    return (
      <EmptyState icon={<LuLock />}>
        {t("You don't have access to this resource collection")}
      </EmptyState>
    );
  }

  if (variant === 'admin-empty') {
    return (
      <div className="rounded-lg border border-neutral-gray1">
        <EmptyState icon={<LuLeaf className="size-6" />}>
          <p className="text-base text-neutral-black">
            {t('No resources yet')}
          </p>
          <p className="max-w-72 text-center text-base text-neutral-charcoal">
            {t(
              'Share documents, guidelines, and links to help participants through the process.',
            )}
          </p>
          {onAddResource ? (
            <Button color="primary" onPress={onAddResource}>
              <LuPlus className="size-4" />
              {t('Add a resource')}
            </Button>
          ) : null}
        </EmptyState>
      </div>
    );
  }

  return (
    <EmptyState icon={<LuLeaf className="size-6" />}>
      {t('No resources yet')}
    </EmptyState>
  );
};
