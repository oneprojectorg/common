'use client';

import { getPublicUrl } from '@/utils';
import type { Proposal } from '@op/common/client';
import {
  normalizeProposalCategories,
  parseProposalData,
} from '@op/common/client';
import { ProposalCard, type ProposalCardAuthor } from '@op/sense/ProposalCard';

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
  const authors = getHovercardAuthors(proposal.submittedBy);

  return (
    <Link
      href={href}
      // `w-fit` + min/max-w clamps the card between 13rem and 20rem so
      // short titles don't stretch and long titles wrap. The card chrome
      // (border/bg/padding) comes from the pin-variant ProposalCard; the
      // Link only carries the hit area, focus ring, and floating shadow.
      className="block w-fit max-w-80 min-w-52 rounded-lg no-underline hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-tealBlack"
    >
      <ProposalCard
        variant="pin"
        title={titleText}
        authors={authors}
        tags={districts}
        className="shadow-md"
      />
    </Link>
  );
}

type HovercardAuthorData = NonNullable<Proposal['submittedBy']>;

/** The single submitter as a facepile author, unless anonymous or absent. */
function getHovercardAuthors(
  author?: HovercardAuthorData,
): ProposalCardAuthor[] | undefined {
  if (!author || author.isAnonymous) {
    return undefined;
  }
  return [
    {
      name: author.name || author.slug,
      avatarSrc: resolveAvatarUrl(author) ?? undefined,
    },
  ];
}

function resolveAvatarUrl(author: HovercardAuthorData): string | null {
  const name = author.avatarImage?.name;
  if (!name) {
    return null;
  }
  return getPublicUrl(name) ?? null;
}
