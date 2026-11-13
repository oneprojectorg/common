import type { Locale } from '@/lib/i18n';
import { redirect } from '@/lib/i18n';

import { decisionRootHref } from '@/components/decisions/proposalHrefs';

import { redirectConvertedInstance } from '../redirectConvertedInstance';

// The legacy decision view has no phase sub-routes — its root page already
// renders the current state. Redirect so shared links built against the new
// `<decisionRoot>/current` shape still resolve here.
export default async function LegacyDecisionCurrentPage({
  params,
}: {
  params: Promise<{ locale: Locale; slug: string; id: string }>;
}) {
  const { locale, slug, id } = await params;
  await redirectConvertedInstance({
    instanceId: id,
    locale,
    href: (decisionSlug) =>
      `${decisionRootHref({ decisionSlug, slug, instanceId: id })}/current`,
  });
  redirect({ href: decisionRootHref({ slug, instanceId: id }), locale });
}
