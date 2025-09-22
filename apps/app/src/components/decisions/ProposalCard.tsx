'use client';

import {
  formatCurrency,
  getTextPreview,
  parseProposalData,
} from '@/utils/proposalUtils';
import { ProposalStatus, type proposalEncoder } from '@op/api/encoders';
import { Chip } from '@op/ui/Chip';
import { Surface } from '@op/ui/Surface';
import { Heart, MessageCircle } from 'lucide-react';
import { LuBookmark } from 'react-icons/lu';
import { z } from 'zod';

import { useTranslations } from '@/lib/i18n';
import { Link } from '@/lib/i18n/routing';

import { OrganizationAvatar } from '../OrganizationAvatar';
import { ProposalCardActions } from './ProposalCardActions';
import { ProposalCardMenu } from './ProposalCardMenu';

type Proposal = z.infer<typeof proposalEncoder>;

interface ProposalCardProps {
  proposal: Proposal;
  viewHref: string;
  canManageProposals?: boolean;
}

export function ProposalCard({
  proposal: currentProposal,
  viewHref,
  canManageProposals = false,
}: ProposalCardProps) {
  const t = useTranslations();

  // Parse proposal data using shared utility
  const { title, budget, category, description } = parseProposalData(
    currentProposal.proposalData,
  );
  const status = currentProposal.status;

  return (
    <Surface className="relative space-y-3 p-6 pb-4">
      {/* Header with title and budget */}
      <div className="flex flex-col items-start justify-between gap-2 sm:flex-row">
        <Link
          href={viewHref}
          className="font-serif !text-title-sm text-neutral-black transition-colors hover:text-primary-teal"
        >
          {title || t('Untitled Proposal')}
        </Link>
        <div className="flex gap-2">
          {budget && (
            <span className="font-serif text-title-base text-neutral-charcoal">
              {formatCurrency(budget)}
            </span>
          )}

          {canManageProposals && (
            <ProposalCardMenu proposal={currentProposal} />
          )}
        </div>
      </div>

      {/* Author and category */}
      <div className="flex items-center gap-3">
        {currentProposal.submittedBy && (
          <>
            <OrganizationAvatar
              profile={currentProposal.submittedBy}
              className="size-6"
            />

            <Link
              href={`/profile/${currentProposal.submittedBy.slug}`}
              className="text-base text-neutral-charcoal"
            >
              {currentProposal.submittedBy.name ||
                currentProposal.submittedBy.slug}
            </Link>
          </>
        )}
        {category && (
          <>
            <span className="text-sm text-neutral-gray2">•</span>
            <Chip className="max-w-96 overflow-hidden overflow-ellipsis text-nowrap">
              {category}
            </Chip>
          </>
        )}
        {status === ProposalStatus.APPROVED ? (
          <>
            <span className="text-sm text-neutral-gray2">•</span>
            <span className="text-sm text-green-700">{t('Shortlisted')}</span>
          </>
        ) : null}
      </div>

      {/* Description */}
      {description && (
        <p className="mb-4 line-clamp-3 text-base text-neutral-charcoal">
          {getTextPreview(description)}
        </p>
      )}

      {/* Footer with engagement */}
      <div className="flex flex-col justify-between gap-4 pt-3 sm:flex-row">
        <div className="flex w-full items-center justify-between gap-4 text-base text-neutral-gray4 sm:justify-normal">
          <span className="flex items-center gap-1">
            <Heart className="h-4 w-4" />
            <span>
              {currentProposal.likesCount || 0} {t('Likes')}
            </span>
          </span>
          <span className="flex items-center gap-1">
            <MessageCircle className="h-4 w-4" />
            <span>
              {currentProposal.commentsCount || 0} {t('Comments')}
            </span>
          </span>
          <span className="flex items-center gap-1">
            <LuBookmark className="size-4" />
            <span>
              {currentProposal.followersCount || 0} {t('Followers')}
            </span>
          </span>
        </div>
        <ProposalCardActions proposal={currentProposal} />
      </div>
    </Surface>
  );
}
