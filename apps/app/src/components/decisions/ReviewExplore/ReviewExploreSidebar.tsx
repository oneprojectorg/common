import { Button } from '@op/ui/Button';
import { Sidebar } from '@op/ui/Sidebar';
import { cn } from '@op/ui/utils';
import { LuCircleCheck, LuClock4 } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

export type ReviewStatus = 'not-started' | 'in-progress' | 'completed';

export interface SidebarProposal {
  id: string;
  name: string;
  reviewStatus: ReviewStatus;
  isActive: boolean;
}

export function ReviewExploreSidebar({
  proposals,
  onSelectProposal,
}: {
  proposals: SidebarProposal[];
  onSelectProposal?: (proposal: SidebarProposal) => void;
}) {
  const t = useTranslations();

  return (
    <Sidebar label={t('Proposals')} className="border-r">
      <ReviewExploreProposalList
        proposals={proposals}
        className="w-64 px-8 pt-8"
        onSelectProposal={onSelectProposal}
      />
    </Sidebar>
  );
}

export function ReviewExploreProposalList({
  proposals,
  className,
  onSelectProposal,
}: {
  proposals: SidebarProposal[];
  className?: string;
  onSelectProposal?: (proposal: SidebarProposal) => void;
}) {
  return (
    <nav className={cn('flex flex-col gap-1', className)}>
      {proposals.map((proposal) => (
        <SidebarItem
          key={proposal.id}
          proposal={proposal}
          onSelectProposal={onSelectProposal}
        />
      ))}
    </nav>
  );
}

function SidebarItem({
  proposal,
  onSelectProposal,
}: {
  proposal: SidebarProposal;
  onSelectProposal?: (proposal: SidebarProposal) => void;
}) {
  const icon = (() => {
    if (proposal.reviewStatus === 'completed') {
      return <LuCircleCheck className="size-4 shrink-0" />;
    }
    if (proposal.reviewStatus === 'in-progress') {
      return <LuClock4 className="size-4 shrink-0" />;
    }
    return null;
  })();

  return (
    <Button
      unstyled
      onPress={() => onSelectProposal?.(proposal)}
      className={cn(
        'flex h-8 w-full items-center gap-2 rounded-sm px-2 text-left text-base',
        proposal.isActive && 'bg-whiteish text-midGray',
        !proposal.isActive &&
          proposal.reviewStatus === 'completed' &&
          'text-green-700',
        !proposal.isActive &&
          proposal.reviewStatus !== 'completed' &&
          'text-neutral-black',
      )}
    >
      {icon}
      <span className="truncate">{proposal.name}</span>
    </Button>
  );
}
