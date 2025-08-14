'use client';

import type { proposalEncoder, processPhaseSchema } from '@op/api/encoders';
import { GradientHeader } from '@op/ui/Header';
import { Surface } from '@op/ui/Surface';
import { useLocale } from 'next-intl';
import type { z } from 'zod';

import { DecisionStats } from './DecisionStats';
import { EmptyProposalsState } from './EmptyProposalsState';
import { ProposalsList } from './ProposalsList';

type Proposal = z.infer<typeof proposalEncoder>;
type ProcessPhase = z.infer<typeof processPhaseSchema>;

interface DecisionInstanceContentProps {
  name: string;
  description?: string;
  budget?: number;
  currentPhase?: ProcessPhase;
  proposalCount: number;
  daysRemaining?: number;
  createProposalHref: string;
  proposals: Proposal[];
}

export function DecisionInstanceContent({
  name,
  description,
  budget,
  currentPhase,
  proposalCount,
  daysRemaining,
  createProposalHref,
  proposals,
}: DecisionInstanceContentProps) {
  const locale = useLocale();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      // TODO: this needs to come from the configuration
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const calculateDaysRemaining = () => {
    if (daysRemaining !== undefined) return daysRemaining;

    if (currentPhase?.phase?.endDate) {
      const endDate = new Date(currentPhase.phase.endDate);
      const today = new Date();
      const diffTime = endDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return Math.max(0, diffDays);
    }

    return null;
  };

  const remainingDays = calculateDaysRemaining();

  const handleProposalLike = (proposalId: string) => {
    // TODO
    console.log('Like proposal:', proposalId);
  };

  const handleProposalFollow = (proposalId: string) => {
    // TODO
    console.log('Follow proposal:', proposalId);
  };

  return (
    <div className="min-h-full bg-gray-50 px-6 py-12">
      <div className="mx-auto max-w-6xl">
        {/* heading */}
        <div className="mb-12 text-center">
          <GradientHeader className="items-center align-middle">
            SHARE YOUR IDEAS.
          </GradientHeader>
          <p className="mt-4 text-base text-gray-700">
            Help determine how we invest our{' '}
            {budget ? formatCurrency(budget) : '$25,000'} community budget.
          </p>
        </div>

        {/* Main content card */}
        <Surface className="p-8">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            {/* Left column - Process Info */}
            <div>
              <h2 className="text-2xl font-semibold text-neutral-charcoal">
                {name}
              </h2>
              <p className="mt-4 leading-relaxed text-neutral-gray3">
                {description ||
                  'Help decide how we allocate our $25,000 community budget. Submit proposals for initiatives that advance our mission of food justice through labor organizing.'}
              </p>

              <div className="mt-8">
                <a
                  href={createProposalHref}
                  className="inline-flex items-center justify-center rounded-md bg-primary-teal px-8 py-3 text-base font-medium text-white shadow-sm transition-colors hover:bg-primary-tealBlack focus:outline-none focus:ring-2 focus:ring-primary-teal focus:ring-offset-2"
                >
                  Submit a proposal
                </a>
              </div>
            </div>

            {/* Right column  */}
            <div className="space-y-6">
              <DecisionStats
                currentPhase={currentPhase}
                budget={budget}
                proposalCount={proposalCount}
                daysRemaining={remainingDays}
              />

              {proposals.length === 0 && <EmptyProposalsState />}
            </div>
          </div>
        </Surface>

        {/* Proposals Section - outside the main card */}
        <ProposalsList
          proposals={proposals}
          onProposalLike={handleProposalLike}
          onProposalFollow={handleProposalFollow}
        />
      </div>
    </div>
  );
}
