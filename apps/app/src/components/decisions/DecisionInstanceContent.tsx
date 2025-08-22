'use client';

import { getPublicUrl } from '@/utils';
import { formatCurrency, getUniqueSubmitters } from '@/utils/proposalUtils';
import type { proposalEncoder } from '@op/api/encoders';
import { Avatar } from '@op/ui/Avatar';
import { FacePile } from '@op/ui/FacePile';
import { GradientHeader } from '@op/ui/Header';
import { useLocale } from 'next-intl';
import Image from 'next/image';
import type { z } from 'zod';

type Proposal = z.infer<typeof proposalEncoder>;

interface DecisionInstanceContentProps {
  budget?: number;
  proposals: Proposal[];
}

export function DecisionInstanceContent({
  budget,
  proposals,
}: DecisionInstanceContentProps) {
  const locale = useLocale();

  const uniqueSubmitters = getUniqueSubmitters(proposals);

  return (
    <div className="min-h-full py-8">
      <div className="mx-auto">
        {/* heading */}
        <div className="text-center">
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
