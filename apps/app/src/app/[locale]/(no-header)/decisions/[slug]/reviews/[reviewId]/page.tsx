import { createClient } from '@op/api/serverClient';
import { CommonError } from '@op/common';
import { notFound } from 'next/navigation';

import { ReviewLayoutClient } from '@/components/decisions/Review/ReviewLayoutClient';

export default async function ReviewProposalPage({
  params,
}: {
  params: Promise<{ slug: string; reviewId: string }>;
}) {
  const { slug, reviewId: assignmentId } = await params;
  const client = await createClient();

  let initialData;
  try {
    initialData = await client.decision.getReviewAssignment({ assignmentId });
  } catch (error) {
    const cause = error instanceof Error ? error.cause : null;
    if (cause instanceof CommonError && cause.statusCode === 404) {
      notFound();
    }
    throw error;
  }

  if (!initialData.rubricTemplate) {
    notFound();
  }

  return (
    <ReviewLayoutClient
      decisionSlug={slug}
      assignmentId={assignmentId}
      initialData={initialData}
    />
  );
}
