'use client';

import type { SaveStatus } from '@/hooks/useTiptapCollab';
import { useRelativeTime } from '@op/hooks';

import { useTranslations } from '@/lib/i18n';

interface ProposalSaveStatusProps {
  saveStatus: SaveStatus;
  lastSavedAt: Date | null;
}

/**
 * Displays the autosave status of the proposal editor.
 * Shows "Saving...", "Saved X ago", or error states.
 */
export function ProposalSaveStatus({
  saveStatus,
  lastSavedAt,
}: ProposalSaveStatusProps) {
  const t = useTranslations();
  const relativeTime = useRelativeTime(lastSavedAt ?? new Date());

  const getStatusText = () => {
    if (saveStatus === 'error') {
      return t('Error saving');
    }
    if (lastSavedAt) {
      return `${t('Saved')} ${relativeTime}`;
    }
    return null;
  };

  const statusText = getStatusText();

  if (!statusText) {
    return null;
  }

  return (
    <span
      className="text-sm text-neutral-charcoal"
      aria-live="polite"
      aria-atomic="true"
    >
      {statusText}
    </span>
  );
}
