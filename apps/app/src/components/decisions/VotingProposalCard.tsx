'use client';

import { cn } from '@op/ui/utils';
import { ReactNode } from 'react';

import { ProposalCard } from './ProposalCard';

interface VotingProposalCardProps {
  proposalId: string;
  children: ReactNode;
  isVotingEnabled?: boolean;
  isReadOnly?: boolean;
  isSelected?: boolean;
  onToggle?: (proposalId: string) => void;
  className?: string;
}

export function VotingProposalCard({
  proposalId,
  children,
  isVotingEnabled = false,
  isReadOnly = false,
  isSelected = false,
  onToggle,
  className = '',
}: VotingProposalCardProps) {
  const canInteract = isVotingEnabled && !isReadOnly && onToggle;

  const handleCardClick = () => {
    if (!canInteract || !onToggle) {
      return;
    }

    onToggle(proposalId);
  };

  return (
    <ProposalCard
      className={cn(
        'relative w-full min-w-80 space-y-3 p-4 pb-4 transition-all',
        canInteract && 'cursor-pointer hover:shadow-md',
        canInteract && !isSelected && 'hover:border-neutral-gray2',
        isSelected && 'border-primary-teal bg-primary-tealWhite',
        className,
      )}
      onClick={canInteract ? handleCardClick : undefined}
      role={canInteract ? 'button' : undefined}
      aria-pressed={canInteract ? isSelected : undefined}
      aria-label={
        canInteract
          ? `${isSelected ? 'Deselect' : 'Select'} proposal for voting`
          : undefined
      }
    >
      {children}
    </ProposalCard>
  );
}
