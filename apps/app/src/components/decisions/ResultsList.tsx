'use client';

import { trpc } from '@op/api/client';
import { Header3 } from '@op/ui/Header';

import { useTranslations } from '@/lib/i18n';

import { EmptyProposalsState } from './EmptyProposalsState';
import {
  ProposalCard,
  ProposalCardContent,
  ProposalCardDescription,
  ProposalCardFooter,
  ProposalCardHeader,
  ProposalCardMeta,
} from './ProposalCard';

const NoProposalsFound = () => {
  const t = useTranslations();
  return (
    <EmptyProposalsState>
      <Header3 className="!text-title-base text-neutral-black font-serif font-light">
        {t('No results yet for this decision.')}
      </Header3>
      <p className="text-neutral-charcoal text-base">
        {t('Results are still being worked on.')}
      </p>
    </EmptyProposalsState>
  );
};

export const ResultsList = ({
  slug,
  instanceId,
}: {
  slug: string;
  instanceId: string;
}) => {
  const t = useTranslations();

  const [[instanceResults, resultStats]] = trpc.useSuspenseQueries((t) => [
    t.decision.getInstanceResults({
      instanceId,
    }),
    t.decision.getResultsStats({
      instanceId,
    }),
  ]);

  const { items: proposals } = instanceResults;

  if (!proposals || proposals.length === 0) {
    return <NoProposalsFound />;
  }

  return (
    <div className="flex flex-col gap-4 pb-12">
      <div className="flex items-center gap-4">
        <Header3 className="!text-title-base font-serif">
          {t('Funded Proposals')}
        </Header3>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {proposals.map((proposal) => (
          <ProposalCard key={proposal.id}>
            <div className="flex h-full flex-col justify-between gap-3 space-y-3">
              <ProposalCardContent>
                <ProposalCardHeader
                  proposal={proposal}
                  viewHref={`/profile/${slug}/decisions/${instanceId}/proposal/${proposal.profileId}`}
                  allocated={proposal.allocated}
                />

                <ProposalCardMeta proposal={proposal} />

                <ProposalCardDescription proposal={proposal} />
              </ProposalCardContent>
            </div>
            <ProposalCardContent>
              {slug !== 'cowop' && resultStats?.membersVoted ? (
                <div className="flex flex-col gap-3">
                  <div className="border-neutral-silver h-0 w-full border-b" />

                  {/* Footer - Total Votes */}
                  <ProposalCardFooter>
                    <div className="text-neutral-charcoal flex items-start gap-1 text-base">
                      <span className="font-bold">
                        {proposal.voteCount ?? 0}
                      </span>
                      <span>{t('Total Votes')}</span>
                    </div>
                  </ProposalCardFooter>
                </div>
              ) : null}
            </ProposalCardContent>
          </ProposalCard>
        ))}
      </div>
    </div>
  );
};
