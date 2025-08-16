'use client';

import { getPublicUrl } from '@/utils';
import type { processPhaseSchema, proposalEncoder } from '@op/api/encoders';
import { Avatar } from '@op/ui/Avatar';
import { Button } from '@op/ui/Button';
import { FacePile } from '@op/ui/FacePile';
import { GradientHeader, Header3 } from '@op/ui/Header';
import { Surface } from '@op/ui/Surface';
import { useLocale } from 'next-intl';
import Image from 'next/image';
import Link from 'next/link';
import type { z } from 'zod';

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

  // Get unique submitters for the FacePile
  const uniqueSubmitters = proposals.reduce(
    (acc, proposal) => {
      if (
        proposal.submittedBy &&
        !acc.some((s) => s.id === proposal.submittedBy?.id)
      ) {
        acc.push(proposal.submittedBy);
      }
      return acc;
    },
    [] as Array<NonNullable<(typeof proposals)[0]['submittedBy']>>,
  );

  return (
    <div className="min-h-full bg-gray-50 py-12">
      <div className="mx-auto">
        {/* heading */}
        <div className="mb-12 text-center">
          <GradientHeader className="items-center align-middle">
            SHARE YOUR IDEAS.
          </GradientHeader>
          <p className="mt-4 text-base text-gray-700">
            Help determine how we invest our{' '}
            {budget ? formatCurrency(budget) : '$25,000'} community budget.
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
                        className="rounded-full object-cover"
                      />
                    ) : null}
                  </Avatar>
                ))}
              />
              <span className="ml-3 text-sm text-gray-600">
                {uniqueSubmitters.length} member
                {uniqueSubmitters.length !== 1 ? 's' : ''} have submitted
                proposals
              </span>
            </div>
          )}
        </div>

        {/* Main layout with sidebar and content */}
        <div className="flex w-full justify-center bg-white">
          <div className="grid w-full max-w-6xl grid-cols-1 gap-8 p-8 lg:grid-cols-4">
            {/* Left sidebar - Process Info */}
            <div className="lg:col-span-1">
              <div className="flex flex-col gap-4">
                <Header3 className="font-serif !text-title-base text-neutral-black">
                  {name}
                </Header3>
                <p className="text-sm">
                  {description ||
                    'Help decide how we allocate our $25,000 community budget. Submit proposals for initiatives that advance our mission of food justice through labor organizing.'}
                </p>

                <div className="mb-6">
                  <Link href={createProposalHref} className="block">
                    <Button color="primary" className="w-full">
                      Submit a proposal
                    </Button>
                  </Link>
                </div>

                <Surface variant="filled">
                  <div className="mb-2 text-sm font-medium uppercase tracking-wide text-neutral-gray3">
                    Current Phase
                  </div>
                  <div className="mb-4 text-lg font-semibold text-neutral-charcoal">
                    {currentPhase?.name || 'Proposal Submissions'}
                  </div>

                  {currentPhase?.phase?.startDate &&
                    currentPhase?.phase?.endDate && (
                      <div className="mb-4 text-sm text-neutral-gray3">
                        {new Date(
                          currentPhase.phase.startDate,
                        ).toLocaleDateString()}{' '}
                        -{' '}
                        {new Date(
                          currentPhase.phase.endDate,
                        ).toLocaleDateString()}
                      </div>
                    )}

                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-neutral-gray3">Total Budget</span>
                      <span className="font-medium text-neutral-charcoal">
                        {budget ? formatCurrency(budget) : '$25,000'}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-neutral-gray3">
                        Proposals Submitted
                      </span>
                      <span className="font-medium text-neutral-charcoal">
                        {proposalCount}
                      </span>
                    </div>
                    {remainingDays !== null && (
                      <div className="flex justify-between text-sm">
                        <span className="text-neutral-gray3">
                          Days Remaining
                        </span>
                        <span className="font-medium text-neutral-charcoal">
                          {remainingDays}
                        </span>
                      </div>
                    )}
                  </div>
                </Surface>
              </div>
            </div>

            {/* Main content area - Proposals */}
            <div className="lg:col-span-3">
              {proposals.length === 0 ? (
                <EmptyProposalsState />
              ) : (
                <div>
                  {/* Proposals list */}
                  <ProposalsList
                    proposals={proposals}
                    onProposalLike={handleProposalLike}
                    onProposalFollow={handleProposalFollow}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
