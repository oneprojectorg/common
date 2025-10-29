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
      <Header3 className="font-serif !text-title-base font-light text-neutral-black">
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

  const [[instanceResults]] = trpc.useSuspenseQueries((t) => [
    t.decision.getInstanceResults({
      instanceId,
    }),
  ]);

  const { items: proposals } = instanceResults;

  if (!proposals || proposals.length === 0) {
    return <NoProposalsFound />;
  }

  return (
    <div className="flex flex-col gap-6 pb-12">
      <div className="flex items-center gap-4">
        <Header3 className="font-serif">{t('Funded Proposals')}</Header3>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {proposals.map((proposal) => (
          <ProposalCard key={proposal.id}>
            <ProposalCardContent>
              {/* Header with Title and Budget */}
              <ProposalCardHeader
                proposal={proposal}
                viewHref={`/profile/${slug}/decisions/${instanceId}/proposal/${proposal.profileId}`}
              />

              {/* Meta: Author + Category */}
              <ProposalCardMeta proposal={proposal} />

              {/* Description */}
              <ProposalCardDescription proposal={proposal} />

              {/* Divider */}
              <div className="border-neutral-silver h-0 w-full border-b" />

              {/* Footer - Total Votes */}
              <ProposalCardFooter>
                <div className="flex items-start gap-1 text-base text-neutral-charcoal">
                  <span className="font-bold">{proposal.voteCount ?? 0}</span>
                  <span>{t('Total Votes')}</span>
                </div>
              </ProposalCardFooter>
            </ProposalCardContent>
          </ProposalCard>
        ))}
      </div>
    </div>
  );
};
