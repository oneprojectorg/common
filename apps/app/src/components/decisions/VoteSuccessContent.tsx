'use client';

import { Button } from '@op/ui/Button';
import { Header1 } from '@op/ui/Header';
import { LuCheck } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

interface VoteSuccessContentProps {
  onViewProposals: () => void;
  slug: string;
  instanceId: string;
}

export const VoteSuccessContent = ({
  onViewProposals,
}: VoteSuccessContentProps) => {
  const t = useTranslations();

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center px-6 py-8 text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
        <LuCheck className="h-8 w-8 text-green-600" />
      </div>

      <Header1 className="mb-4 font-serif text-2xl font-normal">
        {t('Your ballot is in!')}
      </Header1>

      <p className="mb-6 max-w-md text-base text-neutral-charcoal">
        {t('Thank you for participating in the 2025 Community Vote. Your voice helps shape how we invest in our community.')}
      </p>

      <div className="mb-8 w-full max-w-sm space-y-3 text-left">
        <h3 className="font-medium text-neutral-black">
          {t('Here\'s what will happen next:')}
        </h3>
        <ul className="space-y-2 text-sm text-neutral-charcoal">
          <li className="flex items-start gap-2">
            <span className="text-primary-teal">•</span>
            <span>{t('Voting closes in 7 days on Oct 30, 2025')}</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary-teal">•</span>
            <span>{t('Results will be shared on Nov 5, 2025')}</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary-teal">•</span>
            <span>{t('You\'ll receive an email with the final results')}</span>
          </li>
        </ul>
      </div>

      <Button
        onPress={onViewProposals}
        color="primary"
        className="w-full max-w-sm"
      >
        {t('View all proposals')}
      </Button>
    </div>
  );
};