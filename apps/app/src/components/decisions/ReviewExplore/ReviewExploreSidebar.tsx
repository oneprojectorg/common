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

// Temporary placeholder data until review proposals are provided by the backend.
export const mockReviewProposals: SidebarProposal[] = [
  {
    id: '1',
    name: 'Community Garden Expansion',
    reviewStatus: 'in-progress',
    isActive: true,
  },
  {
    id: '2',
    name: 'Implement Living Wage Policy for City Contractors',
    reviewStatus: 'not-started',
    isActive: false,
  },
  {
    id: '3',
    name: 'Community Garden Expansion Extra line',
    reviewStatus: 'completed',
    isActive: false,
  },
  {
    id: '4',
    name: 'Local Art Festival Planning Extra line',
    reviewStatus: 'completed',
    isActive: false,
  },
  {
    id: '5',
    name: 'Neighborhood Clean-Up Initiative Extra line',
    reviewStatus: 'in-progress',
    isActive: false,
  },
  {
    id: '6',
    name: 'School Playground Upgrade Proposal Extra line',
    reviewStatus: 'not-started',
    isActive: false,
  },
];

export function ReviewExploreSidebar() {
  const t = useTranslations();

  return (
    <Sidebar label={t('Proposals')} className="border-r">
      <ReviewExploreProposalList className="w-64 px-8 pt-8" />
    </Sidebar>
  );
}

export function ReviewExploreProposalList({
  className,
  onSelectProposal,
}: {
  className?: string;
  onSelectProposal?: (proposal: SidebarProposal) => void;
}) {
  return (
    <nav className={cn('flex flex-col gap-1', className)}>
      {mockReviewProposals.map((proposal) => (
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
