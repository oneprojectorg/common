'use client';

import { Button } from '@op/sense/Button';
import { LuArrowLeft } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

/** Returns any panel state that replaced the reviewer list back to it. */
export function BackToReviewers({ onClick }: { onClick: () => void }) {
  const t = useTranslations();

  return (
    <Button
      variant="link"
      size="inline"
      onClick={onClick}
      className="self-start text-base"
    >
      <LuArrowLeft className="size-4 rtl:-scale-x-100" />
      {t('Back to all reviewers')}
    </Button>
  );
}
