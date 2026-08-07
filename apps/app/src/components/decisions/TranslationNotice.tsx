'use client';

import { Button } from '@op/sense/Button';
import { cn } from '@op/sense/lib/utils';

import { useTranslations } from '@/lib/i18n';

import { Bullet } from '../Bullet';

/**
 * "Translated from {language} · View original" attribution shown above
 * machine-translated content — the proposal view, the proposal list, and the
 * decision overview all render this same notice.
 */
export const TranslationNotice = ({
  sourceLanguageName,
  onViewOriginal,
  className,
}: {
  sourceLanguageName: string;
  onViewOriginal: () => void;
  className?: string;
}) => {
  const t = useTranslations();

  return (
    <div className="flex items-center gap-1">
      <p className={cn('text-sm text-neutral-gray4', className)}>
        {t('Translated from {language}', { language: sourceLanguageName })}
      </p>
      <Bullet />
      <Button
        variant="link"
        size="inline"
        onClick={onViewOriginal}
        className="inline text-sm sm:text-sm"
      >
        {t('View original')}
      </Button>
    </div>
  );
};
