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
  searchActive = false,
  className,
}: {
  sourceLanguageName: string;
  onViewOriginal: () => void;
  /**
   * A search is narrowing the list. Search runs against the untranslated
   * titles, so the matched word can be absent from every card on screen —
   * name the scope here, where "View original" is already the way to see it.
   */
  searchActive?: boolean;
  className?: string;
}) => {
  const t = useTranslations();

  return (
    <div className="flex flex-wrap items-center gap-1">
      <p className={cn('text-sm text-muted-foreground', className)}>
        {t('Translated from {language}', { language: sourceLanguageName })}
      </p>
      {searchActive && (
        <>
          <Bullet />
          <p className={cn('text-sm text-muted-foreground', className)}>
            {t('Search matches the original titles, not the translations.')}
          </p>
        </>
      )}
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
