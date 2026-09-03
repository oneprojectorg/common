import { db } from '@op/db/client';

async function test() {
  const processInstanceId = '123';
  const phaseId = 'rev';
  const reviewerProfileId = '456';

  const query = db.query.proposalReviewAssignments.findMany({
    where: {
      processInstanceId,
      phaseId,
      reviewerProfileId,
      proposal: {
        deletedAt: { isNull: true },
        moderationDetachedAt: { isNull: true },
      },
    } as any,
    columns: { id: true, proposalId: true, status: true },
    with: { reviews: { columns: { state: true } } },
    orderBy: { assignedAt: 'asc' },
  });
  console.log(query.toSQL());
}
test();
