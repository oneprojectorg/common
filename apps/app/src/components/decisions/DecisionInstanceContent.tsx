'use client';

import { getPublicUrl } from '@/utils';
import { formatCurrency, getUniqueSubmitters } from '@/utils/proposalUtils';
import type { processPhaseSchema, proposalEncoder } from '@op/api/encoders';
import { Avatar } from '@op/ui/Avatar';
import { Button } from '@op/ui/Button';
import { FacePile } from '@op/ui/FacePile';
import { GradientHeader, Header3 } from '@op/ui/Header';
import { useLocale } from 'next-intl';
import Image from 'next/image';
import Link from 'next/link';
import type { z } from 'zod';

import { CurrentPhaseSurface } from './CurrentPhaseSurface';
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
  createProposalHref: string;
  proposals: Proposal[];
  slug: string;
  instanceId: string;
}

export function DecisionInstanceContent({
  name,
  description,
  budget,
  currentPhase,
  proposalCount,
  createProposalHref,
  proposals,
  slug,
  instanceId,
}: DecisionInstanceContentProps) {
  const locale = useLocale();

  const uniqueSubmitters = getUniqueSubmitters(proposals);

  return (
    <div className="min-h-full py-12">
      <div className="mx-auto">
        {/* heading */}
        <div className="mb-12 bg-offWhite text-center">
          <GradientHeader className="items-center align-middle">
            SHARE YOUR IDEAS.
          </GradientHeader>
          <p className="mt-4 text-base text-gray-700">
            Help determine how we invest our{' '}
            {budget ? formatCurrency(budget, locale) : '$0'} community budget.
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


      </div>
    </div>
  );
}
