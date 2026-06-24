'use client';

import { getPublicUrl } from '@/utils';
import type { Proposal, ProposalProfile } from '@op/common/client';
import {
  normalizeProposalCategories,
  parseProposalData,
} from '@op/common/client';
import { Avatar } from '@op/ui/Avatar';
import { Chip } from '@op/ui/Chip';
import Image from 'next/image';

import { useTranslations } from '@/lib/i18n';
import { Link } from '@/lib/i18n/routing';

interface ProposalMapHovercardProps {
  proposal: Proposal;
  /** Proposal detail href — the whole card navigates here on click. */
  href: string;
}

/**
 * The card that pops above a map pin on hover, showing the proposal's title,
 * author, and council district (the boundary-tagged category). The whole card
 * is one link to the proposal detail.
 */
export function ProposalMapHovercard({
  proposal,
  href,
}: ProposalMapHovercardProps) {
  const t = useTranslations();
  const { title, category } = parseProposalData(proposal.proposalData);
  // Per the list card's fallback ladder: explicit title → profile name →
  // "Untitled proposal". Keeps the hovercard consistent with the list card.
  const titleText = title || proposal.profile.name || t('Untitled Proposal');
  // Council districts are stored on the proposal as a category — the
  // boundary-import job auto-tags each proposal with the boundary it falls
  // inside (see `decision_boundaries.taxonomyTermId`). A proposal may have
  // any number of categories; if none apply we just omit the row.
  const districts = normalizeProposalCategories(category);

  return (
    <Link
      href={href}
      // Compact card sized to the design — wide enough for a title line but
      // capped so it doesn't blanket nearby pins. `block` strips link
      // underline styling.
      className="bg-neutral-white block w-64 max-w-[16rem] cursor-pointer rounded-md border border-neutral-gray2 p-3 text-neutral-black no-underline shadow-md hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-tealBlack"
    >
      <div className="space-y-2">
        <p className="line-clamp-2 font-serif text-title-sm text-neutral-black">
          {titleText}
        </p>
        <HovercardAuthor author={proposal.submittedBy} />
        <HovercardDistricts districts={districts} />
      </div>
    </Link>
  );
}

type HovercardAuthorData = ProposalProfile & { isAnonymous?: boolean };

function HovercardAuthor({ author }: { author?: HovercardAuthorData }) {
  if (!author || author.isAnonymous) {
    return null;
  }
  return (
    <div className="flex items-center gap-2">
      <HovercardAvatar author={author} />
      <span className="truncate text-sm text-neutral-charcoal">
        {author.name}
      </span>
    </div>
  );
}

function HovercardAvatar({ author }: { author: HovercardAuthorData }) {
  const avatarUrl = resolveAvatarUrl(author);
  return (
    <Avatar
      placeholder={author.name || author.slug}
      className="size-5 min-h-5 min-w-5"
    >
      {avatarUrl ? (
        <Image src={avatarUrl} alt="" fill className="object-cover" />
      ) : null}
    </Avatar>
  );
}

function resolveAvatarUrl(author: HovercardAuthorData): string | null {
  const name = author.avatarImage?.name;
  if (!name) {
    return null;
  }
  return getPublicUrl(name) ?? null;
}

function HovercardDistricts({ districts }: { districts: string[] }) {
  if (districts.length === 0) {
    return null;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {districts.map((district) => (
        <Chip key={district} className="block max-w-full truncate">
          {district}
        </Chip>
      ))}
    </div>
  );
}
