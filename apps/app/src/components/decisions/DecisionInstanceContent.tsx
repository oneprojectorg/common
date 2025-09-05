'use client';

import { getPublicUrl } from '@/utils';
import { pluralize } from '@/utils/pluralize';
import { getUniqueSubmitters } from '@/utils/proposalUtils';
import { trpc } from '@op/api/client';
import { Avatar } from '@op/ui/Avatar';
import { FacePile } from '@op/ui/FacePile';
import { GradientHeader } from '@op/ui/Header';
import Image from 'next/image';

import { useTranslations } from '@/lib/i18n/routing';

interface DecisionInstanceContentProps {
  instanceId: string;
}

export function DecisionInstanceContent({
  instanceId,
}: DecisionInstanceContentProps) {
  const t = useTranslations();
  const [{ proposals }] = trpc.decision.listProposals.useSuspenseQuery({
    processInstanceId: instanceId,
    limit: 20,
  });

  const uniqueSubmitters = getUniqueSubmitters(proposals);

  return (
    <div className="min-h-full px-4 py-8">
      <div className="mx-auto flex max-w-3xl justify-center">
        {/* heading */}
        <div className="text-center">
          <GradientHeader className="items-center align-middle uppercase">
            {t(
              "Decide how to allocate part of People Powered's budget for 2026",
            )}
          </GradientHeader>
          <p className="mt-4 text-base text-gray-700">
            <p>
              {t(
                'During 2023, People Powered members and staff co-created the strategic plan that guides our work from 2024 to 2026.',
              )}
            </p>
            <p>
              {t(
                "Now, you will decide how to allocate part of People Powered's 2026 budget, in order to advance our strategic plan and move us toward the future horizons of participatory democracy.",
              )}
            </p>
            <p>
              {' '}
              {t(
                'This is the idea collection phase! You can submit your ideas, even if they are not structured yet. We will have time to develop them in the next phase!',
              )}
            </p>
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
                        className="aspect-square rounded-full object-cover"
                      />
                    ) : null}
                  </Avatar>
                ))}
              />
              <span className="w-fit text-sm text-neutral-charcoal">
                {uniqueSubmitters.length}{' '}
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
