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
 * The card that pops above a map pin on hover, showing the proposal's title
 * and — on the row below — the author and council district (the boundary-
 * tagged category) inline. The whole card is one link to the proposal.
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
  // inside (see `decision_boundaries.taxonomyTermId`).
  const districts = normalizeProposalCategories(category);

  return (
    <Link
      href={href}
      // White card with a soft shadow and rounded corners — matches the
      // Figma spec. `block` strips link underline styling; `w-fit` shrinks
      // the card to its content (so a short title doesn't stretch the card)
      // and the min/max-w pair clamps it between ~13rem and 20rem — long
      // titles wrap at the max width instead of running off into a single
      // long line.
      className="block w-fit max-w-[20rem] min-w-[13.33rem] cursor-pointer rounded-lg border border-neutral-gray1 bg-white p-4 text-neutral-black no-underline shadow-md hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-tealBlack"
    >
      <p className="line-clamp-2 font-serif text-title-sm14 text-neutral-black">
        {titleText}
      </p>
      <HovercardMeta author={proposal.submittedBy} districts={districts} />
    </Link>
  );
}

type HovercardAuthorData = ProposalProfile & { isAnonymous?: boolean };

function HovercardMeta({
  author,
  districts,
}: {
  author?: HovercardAuthorData;
  districts: string[];
}) {
  // Avatar + name + district chip all live on the same row per the design.
  // Each child returns null when it has nothing to show; `empty:hidden`
  // collapses the row when both are absent so the title doesn't get a
  // ghost margin.
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 empty:mt-0 empty:hidden">
      <HovercardAuthor author={author} />
      <HovercardDistricts districts={districts} />
    </div>
  );
}

function HovercardAuthor({ author }: { author?: HovercardAuthorData }) {
  if (!author || author.isAnonymous) {
    return null;
  }
  return (
    <span className="flex min-w-0 items-center gap-2">
      <HovercardAvatar author={author} />
      <span className="truncate text-sm text-neutral-charcoal">
        {author.name}
      </span>
    </span>
  );
}

function HovercardAvatar({ author }: { author: HovercardAuthorData }) {
  const avatarUrl = resolveAvatarUrl(author);
  return (
    <Avatar
      placeholder={author.name || author.slug}
      className="size-4 min-h-4 min-w-4"
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
    <span className="flex min-w-0 flex-wrap items-center gap-1">
      {districts.map((district) => (
        <Chip key={district} className="block max-w-full truncate">
          {district}
        </Chip>
      ))}
    </span>
  );
}
