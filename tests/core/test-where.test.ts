import { db } from '@op/db/client';
import { it } from 'vitest';

it('should print SQL', async () => {
  const query = db.query.proposalReviewAssignments.findMany({
    where: {
      processInstanceId: '123',
      phaseId: 'rev',
      reviewerProfileId: '456',
      proposal: {
        deletedAt: { isNull: true },
        moderationDetachedAt: { isNull: true },
      },
    } as any,
    columns: { id: true, proposalId: true, status: true },
  });
  console.log('SQL:', (query as any).toSQL());
});
