import { db } from '@op/db/client';
import { permission } from 'access-zones';

import { NotFoundError } from '../../../utils';
import { selectEmailRecipients } from '../../../utils/email';
import { listIndividualProfileRecipientsByProfileId } from '../../email/recipients';
import { isCategoryReviewerDevelopConfirmed } from '../developLock';
import { getProfileIdsWithDecisionPermission } from '../getProfileIdsWithDecisionPermission';
import { countAdvancingByCategory } from './countAdvancingByCategory';

export type CategoryDevelopmentRecipients = {
  /** At least one category reviewer row for the phase, and every one confirmed. */
  isComplete: boolean;
  categoryName: string;
  processName: string;
  decisionSlug: string;
  advancingCount: number;
  /** Every holder of decisions Admin on the instance profile. */
  adminEmails: string[];
  /** The category reviewers of the category for the phase, minus `adminEmails`. */
  reviewerEmails: string[];
};

/**
 * Who hears that the develop work of a category is confirmed, and what the
 * message names. No access check: the caller is a background function.
 */
export async function getCategoryDevelopmentRecipients({
  processInstanceId,
  phaseId,
  taxonomyTermId,
}: {
  processInstanceId: string;
  phaseId: string;
  taxonomyTermId: string;
}): Promise<CategoryDevelopmentRecipients> {
  const [instance, term, rows, advancingCounts] = await Promise.all([
    db.query.processInstances.findFirst({
      where: { id: processInstanceId },
      columns: { name: true, profileId: true },
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
    countAdvancingByCategory({ processInstanceId }),
  ]);

  if (!instance?.profileId || !instance.profile) {
    throw new NotFoundError('Process instance', processInstanceId);
  }

  if (!term) {
    throw new NotFoundError('Category', taxonomyTermId);
  }

  const adminProfileIds = await getProfileIdsWithDecisionPermission({
    decisionProfileId: instance.profileId,
    permission: permission.ADMIN,
  });
  const reviewerProfileIds = rows.map((row) => row.reviewerProfileId);
  const recipientsByProfileId =
    await listIndividualProfileRecipientsByProfileId([
      ...new Set([...adminProfileIds, ...reviewerProfileIds]),
    ]);
  const emailsOf = (profileIds: string[]) =>
    selectEmailRecipients(
      profileIds.flatMap(
        (profileId) => recipientsByProfileId.get(profileId) ?? [],
      ),
    );

  const adminEmails = emailsOf(adminProfileIds);
  const adminEmailKeys = new Set(
    adminEmails.map((email) => email.toLowerCase()),
  );

  return {
    isComplete: rows.length > 0 && rows.every((row) => row.isConfirmed),
    categoryName: term.label,
    processName: instance.name,
    decisionSlug: instance.profile.slug,
    advancingCount: advancingCounts.get(taxonomyTermId) ?? 0,
    adminEmails,
    reviewerEmails: emailsOf(reviewerProfileIds).filter(
      (email) => !adminEmailKeys.has(email.toLowerCase()),
    ),
  };
}
