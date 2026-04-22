import PostHogClient from '@/posthog';
import { getUser } from '@/utils/getUser';
import { notFound } from 'next/navigation';

import { ReviewLayout } from '@/components/decisions/Review/ReviewLayout';

export default async function ReviewProposalPage({
  params,
}: {
  params: Promise<{ slug: string; reviewId: string }>;
}) {
  const { slug: decisionSlug, reviewId: assignmentId } = await params;

  if (!(await isReviewFlowEnabled())) {
    notFound();
  }

  return (
    <ReviewLayout decisionSlug={decisionSlug} assignmentId={assignmentId} />
  );
}

async function isReviewFlowEnabled() {
  if (
    process.env.NODE_ENV === 'development' ||
    process.env.NEXT_PUBLIC_E2E === 'true'
  ) {
    return true;
  }

  const user = await getUser();
  const posthog = PostHogClient();
  try {
    const enabled = await posthog.isFeatureEnabled(
      'review_flow',
      user.authUserId,
    );
    // Match client semantics: only reject on explicit false.
    return enabled !== false;
  } finally {
    await posthog.shutdown();
  }
}
