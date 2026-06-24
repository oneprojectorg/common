'use client';

import { getPublicUrl } from '@/utils';
import { type Proposal, normalizeProposalCategories } from '@op/common/client';
import { Avatar } from '@op/ui/Avatar';
import { Surface } from '@op/ui/Surface';
import Image from 'next/image';

import { useTranslations } from '@/lib/i18n';
import { Link } from '@/lib/i18n/routing';

import { useCardTranslation } from '../ProposalTranslationContext';
import { resolveProposalSystemFields } from '../proposalContentUtils';

interface ProposalMapHoverCardProps {
  proposal: Proposal;
  /** Proposal detail link — the whole card is one link target. */
  href: string;
}

/**
 * The hovercard rendered above a proposal map pin while it is active. Shows
 * the proposal title, author (avatar + name), and the council district the
 * proposal falls in (its boundary-tagged category). The whole card is one
 * link to the proposal detail.
 */
export function ProposalMapHoverCard({
  proposal,
  href,
}: ProposalMapHoverCardProps) {
  const t = useTranslations();
  const cardTranslation = useCardTranslation(proposal.profileId);
  const { title, category } = resolveProposalSystemFields(proposal);

  const titleText =
    cardTranslation?.title ??
    (title || proposal.profile.name || t('Untitled Proposal'));

  // Boundary-tagged proposals carry one district as their category; fall back
  // to the raw `proposalData.category` when the translation cache is absent.
  const districts = cardTranslation?.category
    ? cardTranslation.category
    : normalizeProposalCategories(category);
  const district = districts[0];

  const author = proposal.submittedBy;
  const avatarUrl = author?.avatarImage?.name
    ? getPublicUrl(author.avatarImage.name)
    : null;

  return (
    <Link
      href={href}
      // The whole rectangle is the click target. The link's accessible name
      // is derived implicitly from its children (title + author + district),
      // which is more descriptive than a synthetic `aria-label` would be.
      className="block w-64 text-neutral-black no-underline outline-0 hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-tealBlack"
    >
      <Surface
        variant="empty"
        className="flex w-full flex-col gap-2 p-3 shadow-md transition-colors hover:bg-neutral-offWhite"
      >
        <h4 className="line-clamp-2 font-serif !text-title-sm break-words text-neutral-black">
          {titleText}
        </h4>
        {author ? (
          <div className="flex min-w-0 items-center gap-2">
            <Avatar
              placeholder={author.name || author.slug}
              className="size-5 min-h-5 min-w-5"
            >
              {avatarUrl ? (
                <Image src={avatarUrl} alt="" fill className="object-cover" />
              ) : null}
            </Avatar>
            <span className="truncate text-sm text-neutral-charcoal">
              {author.name}
            </span>
          </div>
        ) : null}
        {district ? (
          <span className="truncate text-sm text-neutral-gray4">
            {district}
          </span>
        ) : null}
      </Surface>
    </Link>
  );
}
