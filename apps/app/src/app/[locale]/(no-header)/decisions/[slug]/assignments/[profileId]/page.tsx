import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { AssignmentsPageShell } from '@/components/decisions/ReviewAssignments/AssignmentsPageShell';
import { ManageAssignmentsAction } from '@/components/decisions/ReviewAssignments/ManageAssignmentsAction';
import { ReviewerAssignmentsSection } from '@/components/decisions/ReviewAssignments/ReviewerAssignmentsSection';

import { loadReviewAssignmentsPage } from '../loadReviewAssignmentsPage';

interface ReviewerAssignmentsPageProps {
  params: Promise<{ slug: string; profileId: string; locale: string }>;
}

// Tab title only — the page is admin-only, so no crawlable metadata is needed.
export async function generateMetadata({
  params,
}: ReviewerAssignmentsPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });

  return { title: t('Review assignments') };
}

/** One reviewer's assignments — admin only. */
export default async function ReviewerAssignmentsPage({
  params,
}: ReviewerAssignmentsPageProps) {
  const { slug, profileId } = await params;
  const { processInstanceId, phaseId } = await loadReviewAssignmentsPage(slug);

  return (
    <AssignmentsPageShell
      backHref={`/decisions/${slug}/current?tab=assignments`}
      action={
        <ManageAssignmentsAction
          processInstanceId={processInstanceId}
          phaseId={phaseId}
          reviewerProfileId={profileId}
        />
      }
    >
      <ReviewerAssignmentsSection
        processInstanceId={processInstanceId}
        phaseId={phaseId}
        reviewerProfileId={profileId}
      />
    </AssignmentsPageShell>
  );
}
