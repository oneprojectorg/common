'use client';

import { getPublicUrl } from '@/utils';
import { formatCurrency, getTextPreview, parseProposalData } from '@/utils/proposalUtils';
import type { proposalEncoder } from '@op/api/encoders';
import { Avatar } from '@op/ui/Avatar';
import { Surface } from '@op/ui/Surface';
import { Heart, MessageCircle, Users } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { z } from 'zod';

type Proposal = z.infer<typeof proposalEncoder>;

interface ProposalCardProps {
  proposal: Proposal;
  onLike?: () => void;
  onFollow?: () => void;
  viewHref: string;
}

export function ProposalCard({ proposal, onLike, onFollow, viewHref }: ProposalCardProps) {
  // Parse proposal data using shared utility
  const { title, budget, category, content } = parseProposalData(proposal.proposalData);

  return (
    <Surface className="p-6">
      {/* Header with title and budget */}
      <div className="mb-3 flex items-start justify-between">
        <Link 
          href={viewHref}
          className="text-lg font-semibold text-neutral-charcoal hover:text-primary-teal transition-colors"
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
        {proposal.submittedBy && (
          <>
            <Avatar
              placeholder={proposal.submittedBy.name || proposal.submittedBy.slug || 'U'}
              className="h-6 w-6"
            >
              {proposal.submittedBy.avatarImage?.name ? (
                <Image
                  src={getPublicUrl(proposal.submittedBy.avatarImage.name) ?? ''}
                  alt={proposal.submittedBy.name || proposal.submittedBy.slug || ''}
                  fill
                  className="aspect-square object-cover"
                />
              ) : null}
            </Avatar>
            <span className="text-sm text-neutral-charcoal">
              {proposal.submittedBy.name || proposal.submittedBy.slug}
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
        <p className="mb-4 text-sm text-neutral-gray3 line-clamp-3">
          {getTextPreview(content)}
        </p>
      )}

      {/* Footer with engagement */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-sm text-neutral-gray2">
          <button 
            onClick={onLike}
            className="flex items-center gap-1 transition-colors hover:text-neutral-charcoal"
          >
            <Heart className="h-4 w-4" />
            <span>0 Likes</span>
          </button>
          <span className="flex items-center gap-1">
            <MessageCircle className="h-4 w-4" />
            <span>0 Comments</span>
          </span>
          <span className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            <span>1 Follower</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onLike}
            className="flex items-center gap-1 rounded-md border border-primary-teal px-3 py-1.5 text-sm text-primary-teal transition-colors hover:bg-primary-teal hover:text-white"
          >
            <Heart className="h-4 w-4" />
            Like
          </button>
          <button
            onClick={onFollow}
            className="rounded-md border border-neutral-gray1 px-3 py-1.5 text-sm text-neutral-charcoal transition-colors hover:bg-neutral-gray1"
          >
            Following
          </button>
        </div>
      </div>
    </Surface>
  );
}