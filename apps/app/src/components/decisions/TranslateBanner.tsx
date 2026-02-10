'use client';

import { TranslateBanner as UITranslateBanner } from '@op/ui/TranslateBanner';

import { useTranslations } from '@/lib/i18n';

/**
 * Floating banner that offers to translate proposal content to Spanish.
 * Shows at the bottom of the proposal view as a pill-shaped button.
 */
export function TranslateBanner({
  onTranslate,
  onDismiss,
  isTranslating,
}: {
  onTranslate: () => void;
  onDismiss: () => void;
  isTranslating: boolean;
}) {
  const t = useTranslations();

  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
      <UITranslateBanner
        onTranslate={onTranslate}
        onDismiss={onDismiss}
        isTranslating={isTranslating}
        size="sm"
        label={isTranslating ? t('Translating...') : t('Translate to Spanish')}
        className="w-fit max-w-[90vw] pl-2 [&>button:first-child>span:last-child]:w-48"
      />
    </div>
  );
}
