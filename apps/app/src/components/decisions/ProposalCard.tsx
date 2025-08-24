import { getPublicUrl } from '@/utils';
import {
  formatCurrency,
  getTextPreview,
  parseProposalData,
} from '@/utils/proposalUtils';
import type { proposalEncoder } from '@op/api/encoders';
import { Avatar } from '@op/ui/Avatar';
import { Surface } from '@op/ui/Surface';
import { Heart, MessageCircle, Users } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { LuBookmark } from 'react-icons/lu';
import { z } from 'zod';

import { ProposalCardActions } from './ProposalCardActions';

type Proposal = z.infer<typeof proposalEncoder>;

interface ProposalCardProps {
  proposal: Proposal;
  viewHref: string;
}

export function ProposalCard({
  proposal: currentProposal,
  viewHref,
}: ProposalCardProps) {
  // Parse proposal data using shared utility
  const { title, budget, category, content } = parseProposalData(
    currentProposal.proposalData,
  );

  return (
    <Surface className="p-6">
      {/* Header with title and budget */}
      <div className="mb-3 flex items-start justify-between">
        <Link
          href={viewHref}
          className="text-lg font-semibold text-neutral-charcoal transition-colors hover:text-primary-teal"
        >
          {title || 'Untitled Proposal'}
        </Link>
        {budget && (
          <span className="text-lg font-semibold text-neutral-charcoal">
            {formatCurrency(budget)}
          </span>
        )}
      </div>

      {/* Author and category */}
      <div className="mb-3 flex items-center gap-3">
        {currentProposal.submittedBy && (
          <>
            <Avatar
              placeholder={
                currentProposal.submittedBy.name ||
                currentProposal.submittedBy.slug ||
                'U'
              }
              className="size-6"
            >
              {currentProposal.submittedBy.avatarImage?.name ? (
                <Image
                  src={
                    getPublicUrl(
                      currentProposal.submittedBy.avatarImage.name,
                    ) ?? ''
                  }
                  alt={
                    currentProposal.submittedBy.name ||
                    currentProposal.submittedBy.slug ||
                    ''
                  }
                  fill
                  className="aspect-square object-cover"
                />
              ) : null}
            </Avatar>
            <span className="text-sm text-neutral-charcoal">
              {currentProposal.submittedBy.name ||
                currentProposal.submittedBy.slug}
            </span>
            <span className="text-sm text-neutral-gray2">•</span>
          </>
        )}
        {category && (
          <span className="rounded-full bg-neutral-gray1 px-3 py-1 text-xs text-neutral-charcoal">
            {category}
          </span>
        )}
      </div>

      {/* Description */}
      {content && (
        <p className="mb-4 line-clamp-3 text-sm text-neutral-gray3">
          {getTextPreview(content)}
        </p>
      )}

      {/* Footer with engagement */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-sm text-neutral-gray2">
          <span className="flex items-center gap-1">
            <Heart className="h-4 w-4" />
            <span>{currentProposal.likesCount || 0} Likes</span>
          </span>
          <span className="flex items-center gap-1">
            <MessageCircle className="h-4 w-4" />
            <span>0 Comments</span>
          </span>
          <span className="flex items-center gap-1">
            <LuBookmark className="size-4" />
            <span>{currentProposal.followersCount || 0} Followers</span>
          </span>
        </div>
        <ProposalCardActions proposal={currentProposal} />
      </div>
    </Surface>
  );
}
