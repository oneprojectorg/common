import { type TransactionType, eq, inArray, sql } from '@op/db/client';
import {
  type DecisionsVoteBallot,
  type DecisionsVoteBallotProposal,
  decisionsVoteBallotProposals,
  decisionsVoteBallots,
} from '@op/db/schema';
import { randomInt } from 'node:crypto';

/**
 * How many existing ballots are rewritten alongside each new one. The new
 * ballot is then one of this many plus one that share a transaction id and
 * a heap position written in the same statement.
 */
export const BALLOT_MIX_SIZE = 64;

// Under the parameter limit for the widest pick row.
const PICKS_INSERT_CHUNK = 1000;

/** Serialises casts on one instance for the rest of the transaction. */
export const lockBallotBox = async ({
  tx,
  processInstanceId,
}: {
  tx: TransactionType;
  processInstanceId: string;
}): Promise<void> => {
  await tx.execute(
    sql`SELECT pg_advisory_xact_lock(hashtext(${'ballot_box:' + processInstanceId}))`,
  );
};

/**
 * Writes a ballot and its picks, mixed in with up to `BALLOT_MIX_SIZE` of the
 * instance's existing ballots.
 *
 * The transaction also records who voted, and Postgres stamps every row it
 * writes with the transaction id (`xmin`) and appends it to the heap in
 * order, so a ballot written on its own is linked to its voter by both. The
 * existing ballots are deleted and written again with the new one, in random
 * order, so that none of the rows written here stands out from the others.
 * Caller holds `lockBallotBox`.
 */
export const castBallotIntoBox = async ({
  tx,
  ballot,
  picks,
}: {
  tx: TransactionType;
  ballot: DecisionsVoteBallot;
  picks: DecisionsVoteBallotProposal[];
}): Promise<void> => {
  // `db.select`: `db.query` has no `ORDER BY random()`.
  const mixed = await tx
    .select()
    .from(decisionsVoteBallots)
    .where(eq(decisionsVoteBallots.processInstanceId, ballot.processInstanceId))
    .orderBy(sql`random()`)
    .limit(BALLOT_MIX_SIZE);

  const mixedIds = mixed.map((row) => row.id);

  const mixedPicks =
    mixedIds.length > 0
      ? await tx.query.decisionsVoteBallotProposals.findMany({
          where: { ballotId: { in: mixedIds } },
        })
      : [];

  if (mixedIds.length > 0) {
    // The picks go with their ballots.
    await tx
      .delete(decisionsVoteBallots)
      .where(inArray(decisionsVoteBallots.id, mixedIds));
  }

  await tx
    .insert(decisionsVoteBallots)
    .values(shuffle([...mixed, ballot]));

  for (const chunk of chunks(shuffle([...mixedPicks, ...picks]))) {
    await tx.insert(decisionsVoteBallotProposals).values(chunk);
  }
};

/** Fisher–Yates with a CSPRNG, so the written order says nothing. */
function shuffle<T>(items: T[]): T[] {
  const result = [...items];

  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [result[i], result[j]] = [result[j]!, result[i]!];
  }

  return result;
}

function* chunks<T>(items: T[]): Generator<T[]> {
  for (let i = 0; i < items.length; i += PICKS_INSERT_CHUNK) {
    yield items.slice(i, i + PICKS_INSERT_CHUNK);
  }
}
