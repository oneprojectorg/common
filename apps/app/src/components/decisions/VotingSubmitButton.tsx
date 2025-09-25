'use client';

import { Button } from '@op/ui/Button';

import { useTranslations } from '@/lib/i18n';

interface VotingSubmitButtonProps {
  selectedCount: number;
  maxVotesPerMember: number;
  isVisible: boolean;
  onSubmit: () => void;
  isSubmitting?: boolean;
}

export function VotingSubmitButton({
  selectedCount,
  maxVotesPerMember,
  isVisible,
  onSubmit,
  isSubmitting = false,
}: VotingSubmitButtonProps) {
  const t = useTranslations();

  if (!isVisible || selectedCount === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 z-50 h-14 w-full items-center border-t border-neutral-gray1 py-2">
      <div className="flex items-center justify-between">
        <span className="text-neutral-black">
          <span className="text-primary-teal">{selectedCount}</span> of{' '}
          {maxVotesPerMember}{' '}
          {maxVotesPerMember === 1 ? 'proposal' : 'proposals'} selected
        </span>

        <Button
          onPress={onSubmit}
          isDisabled={selectedCount === 0 || isSubmitting}
          variant="primary"
        >
          {isSubmitting ? t('Submitting...') : t('Submit my votes')}
        </Button>
      </div>
    </div>
  );
}
