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
  const t = useTranslations();

  if (variant === 'no-access') {
    return (
      <Empty className="border-0">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <LuLock />
          </EmptyMedia>
          <EmptyDescription>
            {t("You don't have access to this resource collection")}
          </EmptyDescription>
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
        <EmptyTitle>{t('No resources added')}</EmptyTitle>
        <EmptyDescription className="max-w-72">
          {variant === 'admin-empty'
            ? t(
                'Share documents, guidelines, and links to help participants through the process.',
              )
            : t("The organizers haven't shared any documents or links yet")}
        </EmptyDescription>
      </EmptyHeader>
      {variant === 'admin-empty' && onAddResource ? (
        <EmptyContent>
          <Button onClick={onAddResource}>
            <LuPlus className="size-4" />
            {t('Add resource')}
          </Button>
        </EmptyContent>
      ) : null}
    </Empty>
  );
};
