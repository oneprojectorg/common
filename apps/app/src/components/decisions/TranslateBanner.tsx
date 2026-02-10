'use client';

import { TranslateBanner as UITranslateBanner } from '@op/ui/TranslateBanner';

import { useTranslations } from '@/lib/i18n';

/**
 * Floating banner that offers to translate proposal content to the user's locale.
 * Shows at the bottom of the proposal view as a pill-shaped button.
 */
export function TranslateBanner({
  onTranslate,
  onDismiss,
  isTranslating,
  languageName,
}: {
  onTranslate: () => void;
  onDismiss: () => void;
  isTranslating: boolean;
  languageName: string;
}) {
  const t = useTranslations();

  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
      <UITranslateBanner
        onTranslate={onTranslate}
        onDismiss={onDismiss}
        isTranslating={isTranslating}
        label={
          isTranslating
            ? t('Translating...')
            : t('Translate to {language}', { language: languageName })
        }
      />
    </div>
  );
}
