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
 * Card shown above a map pin on hover: title + a row with author and
 * council district (the boundary-tagged category). The whole card links
 * to the proposal.
 */
export function ProposalMapHovercard({
  proposal,
  href,
}: ProposalMapHovercardProps) {
  const t = useTranslations();
  const { title, category } = parseProposalData(proposal.proposalData);
  // Match the list card's fallback ladder.
  const titleText = title || proposal.profile.name || t('Untitled Proposal');
  // The boundary-import job tags each proposal with the boundary (council
  // district) it falls inside as a category — see `decision_boundaries`.
  const districts = normalizeProposalCategories(category);

  return (
    <Link
      href={href}
      // `w-fit` + min/max-w clamps the card between 13rem and 20rem so
      // short titles don't stretch and long titles wrap.
      className="block w-fit max-w-80 min-w-52 cursor-pointer rounded-lg border border-neutral-gray1 bg-white p-4 text-neutral-black no-underline shadow-md hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-tealBlack"
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
  // `empty:hidden` collapses the row when both children render null so the
  // title doesn't get a ghost margin.
  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 empty:mt-0 empty:hidden">
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
