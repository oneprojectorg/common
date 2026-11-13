import { createClient } from '@op/api/serverClient';
import { logger } from '@op/logging';
import { cache } from 'react';

import { type Locale, redirect } from '@/lib/i18n';

import {
  decisionRootHref,
  proposalEditHref,
  proposalHref,
} from '@/components/decisions/proposalHrefs';

interface LegacyDecisionParams {
  id: string;
  slug: string;
  locale: Locale;
}

interface LegacyProposalParams extends LegacyDecisionParams {
  profileId: string;
}

// Each helper redirects a converted instance's legacy link; otherwise it returns.
export const redirectConvertedDecision = ({
  id,
  slug,
  locale,
}: LegacyDecisionParams) =>
  redirectConvertedInstance(id, locale, (decisionSlug) =>
    decisionRootHref({ decisionSlug, slug, instanceId: id }),
  );

export const redirectConvertedDecisionCurrent = ({
  id,
  slug,
  locale,
}: LegacyDecisionParams) =>
  redirectConvertedInstance(
    id,
    locale,
    (decisionSlug) =>
      `${decisionRootHref({ decisionSlug, slug, instanceId: id })}/current`,
  );

export const redirectConvertedProposal = ({
  id,
  slug,
  locale,
  profileId,
}: LegacyProposalParams) =>
  redirectConvertedInstance(id, locale, (decisionSlug) =>
    proposalHref({ decisionSlug, profileId, slug, instanceId: id }),
  );

export const redirectConvertedProposalEdit = ({
  id,
  slug,
  locale,
  profileId,
}: LegacyProposalParams) =>
  redirectConvertedInstance(id, locale, (decisionSlug) =>
    proposalEditHref({ decisionSlug, profileId, slug, instanceId: id }),
  );

const redirectConvertedInstance = async (
  instanceId: string,
  locale: Locale,
  href: (decisionSlug: string) => string,
) => {
  const decisionSlug = await getConvertedInstanceSlug(instanceId);

  if (decisionSlug) {
    redirect({ href: href(decisionSlug), locale });
  }
};

// cache() shares one lookup between generateMetadata and the page render.
const getConvertedInstanceSlug = cache(async (instanceId: string) => {
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
