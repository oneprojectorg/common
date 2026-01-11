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
      <Header3 className="font-light font-serif !text-title-base text-neutral-black">
        {t('No results yet for this decision.')}
      </Header3>
      <p className="text-base text-neutral-charcoal">
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
    <div className="gap-4 pb-12 flex flex-col">
      <div className="gap-4 flex items-center">
        <Header3 className="font-serif !text-title-base">
          {t('Funded Proposals')}
        </Header3>
      </div>

      <div className="gap-6 md:grid-cols-2 lg:grid-cols-3 grid grid-cols-1">
        {proposals.map((proposal) => (
          <ProposalCard key={proposal.id}>
            <div className="gap-3 space-y-3 flex h-full flex-col justify-between">
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
                <div className="gap-3 flex flex-col">
                  <div className="border-neutral-silver h-0 w-full border-b" />

                  {/* Footer - Total Votes */}
                  <ProposalCardFooter>
                    <div className="gap-1 flex items-start text-base text-neutral-charcoal">
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
