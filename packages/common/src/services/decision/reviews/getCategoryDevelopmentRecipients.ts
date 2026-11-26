import { db } from '@op/db/client';
import { permission } from 'access-zones';

import { NotFoundError } from '../../../utils';
import { selectEmailRecipients } from '../../../utils/email';
import { listIndividualProfileRecipientsByProfileId } from '../../email/recipients';
import {
  countAdvancingByCategory,
  isCategoryReviewerDevelopConfirmed,
} from '../developLock';
import { getProfileIdsWithDecisionPermission } from '../getProfileIdsWithDecisionPermission';

export type CategoryDevelopmentRecipients = {
  /** At least one category reviewer row for the phase, and every one confirmed. */
  isComplete: boolean;
  categoryName: string;
  processName: string;
  decisionSlug: string;
  advancingCount: number;
  adminEmails: string[];
};

/** No access check: the caller is a background function. */
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
      columns: { id: true },
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
  const recipientsByProfileId =
    await listIndividualProfileRecipientsByProfileId(adminProfileIds);
  const adminEmails = selectEmailRecipients(
    adminProfileIds.flatMap(
      (profileId) => recipientsByProfileId.get(profileId) ?? [],
    ),
  );

  return {
    isComplete: rows.length > 0 && rows.every((row) => row.isConfirmed),
    categoryName: term.label,
    processName: instance.name,
    decisionSlug: instance.profile.slug,
    advancingCount: advancingCounts.get(taxonomyTermId) ?? 0,
    adminEmails,
  };
}
