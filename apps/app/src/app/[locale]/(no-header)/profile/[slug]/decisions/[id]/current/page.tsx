import type { Metadata } from 'next';

import type { Locale } from '@/lib/i18n';
import { redirect } from '@/lib/i18n';

import { decisionRootHref } from '@/components/decisions/proposalHrefs';

import { redirectConvertedDecisionCurrent } from '../redirectConvertedInstance';

interface LegacyDecisionCurrentProps {
  params: Promise<{ locale: Locale; slug: string; id: string }>;
}

// Redirecting here, before the loading boundary streams, gives crawlers a real 307.
export async function generateMetadata({
  params,
}: LegacyDecisionCurrentProps): Promise<Metadata> {
  await redirectConvertedDecisionCurrent(await params);
  return {};
}

// The legacy decision view has no phase sub-routes — its root page already
// renders the current state. Redirect so shared links built against the new
// `<decisionRoot>/current` shape still resolve here.
export default async function LegacyDecisionCurrentPage({
  params,
}: LegacyDecisionCurrentProps) {
  const { locale, slug, id } = await params;
  await redirectConvertedDecisionCurrent({ id, slug, locale });
  redirect({ href: decisionRootHref({ slug, instanceId: id }), locale });
}
