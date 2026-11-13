import { createClient } from '@op/api/serverClient';
import { logger } from '@op/logging';
import { cache } from 'react';
import { z } from 'zod';

import { type Locale, redirect } from '@/lib/i18n';

import {
  decisionRootHref,
  proposalEditHref,
  proposalHref,
} from '@/components/decisions/proposalHrefs';

export type LegacySearchParams = Record<string, string | string[] | undefined>;

interface LegacyDecisionParams {
  id: string;
  slug: string;
  locale: Locale;
  searchParams?: LegacySearchParams;
}

interface LegacyProposalParams extends LegacyDecisionParams {
  profileId: string;
}

const uuidSchema = z.uuid();

// Each helper redirects a converted instance's legacy link; otherwise it returns.
export const redirectConvertedDecision = ({
  id,
  slug,
  locale,
  searchParams,
}: LegacyDecisionParams) =>
  redirectConvertedInstance({
    instanceId: id,
    locale,
    searchParams,
    href: (decisionSlug) =>
      decisionRootHref({ decisionSlug, slug, instanceId: id }),
  });

export const redirectConvertedDecisionCurrent = ({
  id,
  slug,
  locale,
  searchParams,
}: LegacyDecisionParams) =>
  redirectConvertedInstance({
    instanceId: id,
    locale,
    searchParams,
    href: (decisionSlug) =>
      `${decisionRootHref({ decisionSlug, slug, instanceId: id })}/current`,
  });

export const redirectConvertedProposal = ({
  id,
  slug,
  locale,
  searchParams,
  profileId,
}: LegacyProposalParams) =>
  redirectConvertedInstance({
    instanceId: id,
    locale,
    searchParams,
    href: (decisionSlug) =>
      proposalHref({ decisionSlug, profileId, slug, instanceId: id }),
  });

export const redirectConvertedProposalEdit = ({
  id,
  slug,
  locale,
  searchParams,
  profileId,
}: LegacyProposalParams) =>
  redirectConvertedInstance({
    instanceId: id,
    locale,
    searchParams,
    href: (decisionSlug) =>
      proposalEditHref({ decisionSlug, profileId, slug, instanceId: id }),
  });

const redirectConvertedInstance = async ({
  instanceId,
  locale,
  searchParams,
  href,
}: {
  instanceId: string;
  locale: Locale;
  searchParams?: LegacySearchParams;
  href: (decisionSlug: string) => string;
}) => {
  const decisionSlug = await getConvertedInstanceSlug(instanceId);

  if (decisionSlug) {
    redirect({
      href: `${href(decisionSlug)}${toQueryString(searchParams)}`,
      locale,
    });
  }
};

// cache() shares one lookup between generateMetadata and the page render.
const getConvertedInstanceSlug = cache(async (instanceId: string) => {
  // A malformed id can't be an instance; skip the call so it doesn't log as an error.
  if (!uuidSchema.safeParse(instanceId).success) {
    return null;
  }

  try {
    const client = await createClient();
    const { slug } = await client.decision.getConvertedInstanceSlug({
      instanceId,
    });
    return slug;
  } catch (error) {
    logger.error('Converted instance lookup failed', { error, instanceId });
    return null;
  }
});

const toQueryString = (searchParams: LegacySearchParams = {}) => {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    for (const item of [value].flat()) {
      if (item !== undefined) {
        query.append(key, item);
      }
    }
  }

  const queryString = query.toString();
  return queryString ? `?${queryString}` : '';
};
