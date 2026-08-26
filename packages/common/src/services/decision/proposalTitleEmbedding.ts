import { createEmbeddings } from '@op/ai';
import { type Column, type SQL, and, db, eq, isNull, sql } from '@op/db/client';
import {
  PROPOSAL_TITLE_EMBEDDING_DIMENSIONS,
  ProposalStatus,
  profiles,
  proposalTitleEmbeddings,
  proposals,
  toVectorLiteral,
} from '@op/db/schema';
import { logger } from '@op/logging';

/**
 * Embedding model id, resolved per call so a module-scope import never reads
 * the environment. The default is OpenAI's small embedding model, whose width
 * is what `PROPOSAL_TITLE_EMBEDDING_DIMENSIONS` pins the column to.
 */
const getEmbeddingModelId = (): string =>
  process.env.AI_EMBEDDING_MODEL || 'text-embedding-3-small';

const embedTitle = async (title: string): Promise<number[] | null> => {
  const [embedding] = await createEmbeddings({
    model: { modelId: getEmbeddingModelId() },
    texts: [title],
  });

  if (!embedding) {
    return null;
  }

  // The column is `vector(1536)`; a model of a different width needs a
  // migration, so refuse the value here rather than letting Postgres reject the
  // insert (or, on the read path, produce a dimension-mismatch error).
  if (embedding.length !== PROPOSAL_TITLE_EMBEDDING_DIMENSIONS) {
    logger.warn('Embedding model returned an unexpected vector width', {
      modelId: getEmbeddingModelId(),
      expected: PROPOSAL_TITLE_EMBEDDING_DIMENSIONS,
      received: embedding.length,
    });
    return null;
  }

  return embedding;
};

/**
 * Refreshes the cached embedding of a proposal's title. Best-effort: callers
 * fire this without awaiting it, and a failure only costs the proposal its place
 * in the merge-suggestion ranking until the next title write.
 *
 * Drafts are skipped — they never appear as merge candidates, and draft autosave
 * would otherwise bill an inference call per keystroke.
 *
 * Read-then-upsert, so two title writes racing each other settle on whichever
 * finishes last rather than whichever was typed last. Left unlocked on purpose:
 * the loser is a stale ranking hint, not wrong data, and the next title write
 * corrects it.
 *
 * The catch is deliberately broad. This is a fire-and-forget cache refresh whose
 * failure modes are open-ended (unconfigured endpoint, provider outage, quota),
 * and none of them should surface in the write that triggered it. It is logged,
 * not swallowed.
 */
export const syncProposalTitleEmbedding = async ({
  proposalId,
}: {
  proposalId: string;
}): Promise<void> => {
  try {
    const [row] = await db
      .select({
        status: proposals.status,
        title: profiles.name,
        embeddedTitle: proposalTitleEmbeddings.title,
      })
      .from(proposals)
      .innerJoin(profiles, eq(profiles.id, proposals.profileId))
      .leftJoin(
        proposalTitleEmbeddings,
        eq(proposalTitleEmbeddings.proposalId, proposals.id),
      )
      .where(and(eq(proposals.id, proposalId), isNull(proposals.deletedAt)))
      .limit(1);

    if (!row || row.status === ProposalStatus.DRAFT) {
      return;
    }

    const title = row.title?.trim();
    if (!title) {
      return;
    }

    // Autosave sends the title on every keystroke, so the common case is a
    // title that hasn't actually moved. Stop before the inference call.
    if (row.embeddedTitle === title) {
      return;
    }

    const embedding = await embedTitle(title);
    if (!embedding) {
      return;
    }

    await db
      .insert(proposalTitleEmbeddings)
      .values({ proposalId, title, embedding })
      .onConflictDoUpdate({
        target: proposalTitleEmbeddings.proposalId,
        set: {
          title,
          embedding,
          updatedAt: new Date().toISOString(),
        },
      });
  } catch (error) {
    logger.warn('Could not refresh the proposal title embedding', {
      error,
      proposalId,
    });
  }
};

/**
 * The vector to rank merge suggestions against: the stored embedding of the
 * source proposal's title, or a freshly generated one when the proposal predates
 * this cache (or its title was just edited and the refresh hasn't landed).
 *
 * `null` means "rank by nothing" — an unknown proposal, an empty title, or an
 * unavailable inference endpoint. Callers fall back to their normal ordering.
 *
 * Scoped to `processInstanceId` so an arbitrary id can't be used to probe
 * titles outside the decision the caller was already authorized for.
 */
export const getProposalTitleQueryVector = async ({
  proposalId,
  processInstanceId,
}: {
  proposalId: string;
  processInstanceId: string;
}): Promise<number[] | null> => {
  try {
    const [row] = await db
      .select({
        title: profiles.name,
        embedding: proposalTitleEmbeddings.embedding,
      })
      .from(proposals)
      .innerJoin(profiles, eq(profiles.id, proposals.profileId))
      .leftJoin(
        proposalTitleEmbeddings,
        eq(proposalTitleEmbeddings.proposalId, proposals.id),
      )
      .where(
        and(
          eq(proposals.id, proposalId),
          eq(proposals.processInstanceId, processInstanceId),
          isNull(proposals.deletedAt),
        ),
      )
      .limit(1);

    if (!row) {
      return null;
    }

    if (row.embedding) {
      return row.embedding;
    }

    const title = row.title?.trim();
    if (!title) {
      return null;
    }

    return await embedTitle(title);
  } catch (error) {
    logger.warn('Could not resolve a proposal title vector', {
      error,
      proposalId,
    });
    return null;
  }
};

/**
 * Cosine distance between a proposal's stored title embedding and `queryVector`,
 * as a correlated subquery so it composes with the caller's own WHERE clause.
 *
 * `NULL` for a proposal with no cached embedding — order by this with
 * `NULLS LAST` so those proposals fall back to the caller's secondary sort
 * instead of dropping out of the list.
 */
export const buildTitleSimilarityDistance = ({
  queryVector,
  proposalIdColumn,
}: {
  queryVector: number[];
  proposalIdColumn: Column | SQL;
}): SQL<number | null> =>
  sql<number | null>`(
    SELECT ${proposalTitleEmbeddings.embedding} <=> ${toVectorLiteral(queryVector)}::vector
    FROM ${proposalTitleEmbeddings}
    WHERE ${proposalTitleEmbeddings.proposalId} = ${proposalIdColumn}
  )`;
