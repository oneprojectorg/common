import type { Metadata } from 'next';

import type { Locale } from '@/lib/i18n';
import { redirect } from '@/lib/i18n';

import { decisionRootHref } from '@/components/decisions/proposalHrefs';

import {
  type LegacySearchParams,
  redirectConvertedDecisionCurrent,
} from '../redirectConvertedInstance';

interface LegacyDecisionCurrentProps {
  params: Promise<{ locale: Locale; slug: string; id: string }>;
  searchParams: Promise<LegacySearchParams>;
}

// Redirecting here, before the loading boundary streams, gives link unfurlers a real 307; browsers still redirect client-side.
export async function generateMetadata({
  params,
  searchParams,
}: LegacyDecisionCurrentProps): Promise<Metadata> {
  await redirectConvertedDecisionCurrent({
    ...(await params),
    searchParams: await searchParams,
  });
  return {};
}

// The legacy decision view has no phase sub-routes — its root page already
// renders the current state. Redirect so shared links built against the new
// `<decisionRoot>/current` shape still resolve here.
export default async function LegacyDecisionCurrentPage({
  params,
  searchParams,
}: LegacyDecisionCurrentProps) {
  const { locale, slug, id } = await params;
  await redirectConvertedDecisionCurrent({
    id,
    slug,
    locale,
    searchParams: await searchParams,
  });
  redirect({ href: decisionRootHref({ slug, instanceId: id }), locale });
}
