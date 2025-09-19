'use client';

import { getPublicUrl } from '@/utils';
import { pluralize } from '@/utils/pluralize';
import { getUniqueSubmitters } from '@/utils/proposalUtils';
import { trpc } from '@op/api/client';
import { match } from '@op/core';
import { Avatar } from '@op/ui/Avatar';
import { FacePile } from '@op/ui/FacePile';
import { GradientHeader } from '@op/ui/Header';
import Image from 'next/image';
import { useParams } from 'next/navigation';

import { useTranslations } from '@/lib/i18n/routing';

interface DecisionInstanceContentProps {
  instanceId: string;
}

export function DecisionInstanceContent({
  instanceId,
}: DecisionInstanceContentProps) {
  const t = useTranslations();
  const { slug } = useParams();
  const [{ proposals }] = trpc.decision.listProposals.useSuspenseQuery({
    processInstanceId: instanceId,
    limit: 20,
  });

  const uniqueSubmitters = getUniqueSubmitters(proposals);
  // TODO: This match statement is all going to go away. We are going to move all of this into a modal instead so hardcoding here won't be tech-debt.
  // We just need to be sure to move this content into the instance data
  return (
    <div className="min-h-full px-4 py-8">
      <div className="mx-auto flex max-w-3xl justify-center">
        <div className="text-center">
          {match(slug, {
            'people-powered': (
              <>
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
              </>
            ),
            cowop: (
              <>
                <GradientHeader className="items-center align-middle uppercase">
                  {t('SHARE YOUR IDEAS.')}
                </GradientHeader>
                {
                  <p className="mt-4 text-base text-gray-700">
                    <p>COWOP header</p>
                  </p>
                }
              </>
            ),
            _: (
              <>
                <GradientHeader className="items-center align-middle uppercase">
                  {t('SHARE YOUR IDEAS.')}
                </GradientHeader>
                {
                  <p className="mt-4 text-base text-gray-700">
                    <p>
                      In May 2025, One Project Core Capabilities grantees (you
                      all!) identified establishing and/or supporting mutual aid
                      infrastructure as the highest priority for addressing what
                      we need now and in the future.
                    </p>
                    <p>
                      We invite you to apply for funds to boost mutual aid
                      infrastructure capacity that benefits the entire
                      ecosystem.
                    </p>
                    <p>
                      For more details, see the{' '}
                      <a
                        href="https://docs.google.com/document/d/1OPKvQzbMTl3VQsVIvHM1HCk6KrhSbvS5UScvSfmkqT4/edit?tab=t.2dolvnkc9h7e"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-teal hover:underline"
                      >
                        Request for Applications
                      </a>{' '}
                      [also available in{' '}
                      <a
                        href="https://docs.google.com/document/d/1RXbv8cFbBTivlP29p9uhqBlg_yFZIO27/edit?rtpof=true&tab=t.0"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-teal hover:underline"
                      >
                        Spanish
                      </a>
                      ] and{' '}
                      <a
                        href="https://docs.google.com/document/d/1OPKvQzbMTl3VQsVIvHM1HCk6KrhSbvS5UScvSfmkqT4/edit?tab=t.2dolvnkc9h7e"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-teal hover:underline"
                      >
                        start your application
                      </a>{' '}
                      today!
                    </p>
                  </p>
                }
              </>
            ),
          })}

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
