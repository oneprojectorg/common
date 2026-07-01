'use client';

import { Link } from '@op/ui/Link';

import { useTranslations } from '@/lib/i18n';

export const TranslationNotice = ({
  sourceLanguageName,
  onViewOriginal,
}: {
  sourceLanguageName: string;
  onViewOriginal: () => void;
}) => {
  const t = useTranslations();

  return (
    <p className="text-sm text-neutral-gray3">
      {t('Translated from {language}', { language: sourceLanguageName })}{' '}
      &middot;{' '}
      <Link onPress={onViewOriginal} className="text-sm font-semibold">
        {t('View original')}
      </Link>
    </p>
  );
};
