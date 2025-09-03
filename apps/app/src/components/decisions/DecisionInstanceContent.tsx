'use client';

import { getPublicUrl } from '@/utils';
import { pluralize } from '@/utils/pluralize';
import { formatCurrency, getUniqueSubmitters } from '@/utils/proposalUtils';
import { trpc } from '@op/api/client';
import { Avatar } from '@op/ui/Avatar';
import { FacePile } from '@op/ui/FacePile';
import { GradientHeader } from '@op/ui/Header';
import { useLocale } from 'next-intl';
import { useTranslations } from '@/lib/i18n/routing';
import Image from 'next/image';

interface DecisionInstanceContentProps {
  budget?: number;
  hideBudget?: boolean;
  instanceId: string;
}

export function DecisionInstanceContent({
  budget,
  hideBudget,
  instanceId,
}: DecisionInstanceContentProps) {
  const locale = useLocale();
  const t = useTranslations();
  const [{ proposals }] = trpc.decision.listProposals.useSuspenseQuery({
    processInstanceId: instanceId,
    limit: 20,
  });

  const uniqueSubmitters = getUniqueSubmitters(proposals);

  return (
    <div className="min-h-full py-8">
      <div className="mx-auto">
        {/* heading */}
        <div className="text-center">
          <GradientHeader className="items-center align-middle">
            {t('SHARE YOUR IDEAS.')}
          </GradientHeader>
          <p className="mt-4 text-base text-gray-700">
            {budget && !hideBudget
              ? t('Help determine how we invest our {budget} community budget.', {
                  budget: formatCurrency(budget, locale),
                })
              : t('Share your ideas and help shape our community funding decisions.')
            }
          </p>

          {/* Member avatars showing who submitted proposals */}
          {uniqueSubmitters.length > 0 && (
            <div className="mt-6 flex items-center justify-center gap-2">
              <FacePile
                items={uniqueSubmitters.slice(0, 4).map((submitter) => (
                  <Avatar
                    key={submitter.id}
                    placeholder={submitter.name || submitter.slug || 'U'}
                    className="border-2 border-white"
                  >
                    {submitter.avatarImage?.name ? (
                      <Image
                        src={getPublicUrl(submitter.avatarImage.name) ?? ''}
                        alt={submitter.name || submitter.slug || ''}
                        width={32}
                        height={32}
                        className="rounded-full aspect-square object-cover"
                      />
                    ) : null}
                  </Avatar>
                ))}
              />
              <span className="w-fit text-sm text-neutral-charcoal">
                {uniqueSubmitters.length}
                {pluralize(t('member'), uniqueSubmitters.length)}{' '}
                {uniqueSubmitters.length > 1 ? t('have') : t('has')}{' '}
                {t('submitted proposals')}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
