import { db } from '@op/db/client';

import { NotFoundError } from '../../../utils';
import { selectEmailRecipients } from '../../../utils/email';
import { listIndividualProfileRecipientsByProfileId } from '../../email/recipients';
import { isCategoryReviewerDevelopConfirmed } from '../developLock';

export type CategoryAssignmentReceipt = {
  isConfirmed: boolean;
  confirmedCount: number;
  assignmentCount: number;
  categoryName: string;
  processName: string;
  decisionSlug: string;
  emails: string[];
};

/** No access check: the caller is a background function. */
export async function getCategoryAssignmentReceipt({
  processInstanceId,
  phaseId,
  taxonomyTermId,
  reviewerProfileId,
}: {
  processInstanceId: string;
  phaseId: string;
  taxonomyTermId: string;
  reviewerProfileId: string;
}): Promise<CategoryAssignmentReceipt> {
  const [instance, term, assignments, recipientsByProfileId] =
    await Promise.all([
      db.query.processInstances.findFirst({
        where: { id: processInstanceId },
        columns: { name: true },
        with: { profile: { columns: { slug: true } } },
      }),
      db.query.taxonomyTerms.findFirst({
        where: { id: taxonomyTermId },
        columns: { label: true },
      }),
      // Rows with no phase are for review only and do not count.
      db.query.categoryReviewers.findMany({
        where: { processInstanceId, taxonomyTermId, phaseId },
        columns: { reviewerProfileId: true },
        extras: {
          isConfirmed: (table) => isCategoryReviewerDevelopConfirmed(table),
        },
      }),
      listIndividualProfileRecipientsByProfileId([reviewerProfileId]),
    ]);

  if (!instance?.profile) {
    throw new NotFoundError('Process instance', processInstanceId);
  }

  if (!term) {
    throw new NotFoundError('Category', taxonomyTermId);
  }

  const assignment = assignments.find(
    (row) => row.reviewerProfileId === reviewerProfileId,
  );

  if (!assignment) {
    throw new NotFoundError('Category assignment', reviewerProfileId);
  }

  return {
    isConfirmed: assignment.isConfirmed,
    confirmedCount: assignments.filter((row) => row.isConfirmed).length,
    assignmentCount: assignments.length,
    categoryName: term.label,
    processName: instance.name,
    decisionSlug: instance.profile.slug,
    emails: selectEmailRecipients(
      recipientsByProfileId.get(reviewerProfileId) ?? [],
    ),
  };
}
