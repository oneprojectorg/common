import type { Locale } from '@/lib/i18n';
import { redirect } from '@/lib/i18n';

// The legacy decision view has no phase sub-routes — its root page already
// renders the current state. Redirect so shared links built against the new
// `<decisionRoot>/current` shape still resolve here.
export default async function LegacyDecisionCurrentPage({
  params,
}: {
  params: Promise<{ locale: Locale; slug: string; id: string }>;
}) {
  const { locale, slug, id } = await params;
  redirect({ href: `/profile/${slug}/decisions/${id}`, locale });
}
