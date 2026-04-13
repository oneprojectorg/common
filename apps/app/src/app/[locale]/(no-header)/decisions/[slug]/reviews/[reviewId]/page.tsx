import { createClient } from '@op/api/serverClient';
import { CommonError } from '@op/common';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { ReviewLayoutClient } from '@/components/decisions/Review/ReviewLayoutClient';
import { ReviewSkeleton } from '@/components/decisions/Review/ReviewSkeleton';

export default async function ReviewProposalPage({
  params,
}: {
  params: Promise<{ slug: string; reviewId: string }>;
}) {
  const { slug, reviewId: assignmentId } = await params;

  return (
    <Suspense fallback={<ReviewSkeleton />}>
      <ReviewPageContent decisionSlug={slug} assignmentId={assignmentId} />
    </Suspense>
  );
}

async function ReviewPageContent({
  decisionSlug,
  assignmentId,
}: {
  decisionSlug: string;
  assignmentId: string;
}) {
  const client = await createClient();

  let data;
  try {
    data = await client.decision.getReviewAssignment({ assignmentId });
  } catch (error) {
    const cause = error instanceof Error ? error.cause : null;
    if (cause instanceof CommonError && cause.statusCode === 404) {
      notFound();
    }
    throw error;
  }

  if (!data.rubricTemplate) {
    notFound();
  }

  return (
    <ReviewLayoutClient
      decisionSlug={decisionSlug}
      assignmentId={assignmentId}
      assignment={data.assignment}
      rubricTemplate={data.rubricTemplate}
      review={data.review}
    />
  );
}
