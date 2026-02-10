'use client';

import { Languages, X } from 'lucide-react';

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
      <div className="flex items-center gap-2 rounded-full border border-neutral-gray2 bg-white px-4 py-2.5 shadow-lg">
        <button
          type="button"
          onClick={onTranslate}
          disabled={isTranslating}
          className="text-primary-blue flex items-center gap-2 text-sm font-medium disabled:opacity-60"
        >
          <Languages className="size-4" />
          <span>
            {isTranslating ? t('Translating...') : t('Translate to Spanish')}
          </span>
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="ml-1 text-neutral-gray4 hover:text-neutral-charcoal"
          aria-label="Dismiss"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
