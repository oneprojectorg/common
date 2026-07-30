import { type DbClient, and, eq, inArray } from '@op/db/client';
import {
  categoryReviewers,
  proposalCategories,
  proposals,
  taxonomyTerms,
} from '@op/db/schema';
import { logger } from '@op/logging';

import { categoryTermUri } from './proposalTaxonomy';
import { reconcileReviewAssignments } from './reconcileReviewAssignments';
import type { ProposalCategory } from './schemas/types';

/**
 * A category rename detected in the Process Builder: same config-local `id`,
 * different label. Config id detects the rename; the slug (derived from the
 * label) locates the taxonomy terms to move rows between.
 */
export interface CategoryRename {
  oldLabel: string;
  newLabel: string;
}

/** A rename with both taxonomy terms resolved, so the writes are unambiguous. */
interface ResolvedRename extends CategoryRename {
  oldTermId: string;
  newTermId: string;
}

/**
 * Detects category renames between two config category arrays.
 *
 * Keys on the config-local `id`: a category present before with the same id but
 * a different label was renamed, whereas delete + add changes the id. Pure, so
 * it's testable without a database.
 */
export function detectCategoryRenames(
  previous: ProposalCategory[],
  next: ProposalCategory[],
): CategoryRename[] {
  const previousLabelById = new Map(
    previous.map((category) => [category.id, category.label]),
  );

  return next.flatMap((category) => {
    const previousLabel = previousLabelById.get(category.id);
    if (previousLabel === undefined || previousLabel === category.label) {
      return [];
    }
    return [{ oldLabel: previousLabel, newLabel: category.label }];
  });
}

/**
 * Re-points a decision instance's category-keyed rows after categories are
 * renamed.
 *
 * A category label joins to a global, slug-keyed `taxonomyTerms` row, and three
 * tables key on that term: `proposalCategories` (table `decision_categories`),
 * `categoryReviewers` (reviews-by-category scope), and the proposal's own
 * `proposalData.category` label copy. Renaming a category makes
 * `ensureProposalTaxonomyTerms` mint a *new* term for the new label; every
 * holder must move together or they stop agreeing with each other. Moving only
 * the proposal links would sever the term-id equi-join in
 * `getCategoryReviewersByProposal`, silently dropping reviewer coverage of the
 * renamed category (`categoryReviewers` documents its key as append-only for
 * exactly this reason).
 *
 * All reads happen before all writes: renames are applied from one immutable
 * snapshot, so a cascade (`A→B` and `B→C` in a single save) can't sweep A's
 * proposals through B into C, and a swap (`A↔B`) can't collapse both into one.
 *
 * Must run inside the same transaction that writes the renamed `instanceData`,
 * so config and rows commit together.
 */
export async function reconcileCategoryRenames({
  tx,
  instanceId,
  renames,
}: {
  tx: DbClient;
  instanceId: string;
  renames: CategoryRename[];
}): Promise<void> {
  const resolved = await resolveRenames({ tx, instanceId, renames });
  if (resolved.length === 0) {
    return;
  }

  const newTermIdByOldTermId = new Map(
    resolved.map((rename) => [rename.oldTermId, rename.newTermId]),
  );
  const oldTermIds = [...newTermIdByOldTermId.keys()];

  // Snapshot every row to move before touching anything, so later renames read
  // the original state rather than what an earlier one just wrote.
  const [linkSnapshot, scopeSnapshot] = await Promise.all([
    tx
      .select({
        proposalId: proposalCategories.proposalId,
        taxonomyTermId: proposalCategories.taxonomyTermId,
      })
      .from(proposalCategories)
      // Scope to THIS instance's proposals: taxonomy terms are shared across
      // decisions, so another decision still using the old label keeps its rows.
      .innerJoin(proposals, eq(proposals.id, proposalCategories.proposalId))
      .where(
        and(
          inArray(proposalCategories.taxonomyTermId, oldTermIds),
          eq(proposals.processInstanceId, instanceId),
        ),
      ),
    tx
      .select({
        id: categoryReviewers.id,
        taxonomyTermId: categoryReviewers.taxonomyTermId,
        reviewerProfileId: categoryReviewers.reviewerProfileId,
        phaseId: categoryReviewers.phaseId,
      })
      .from(categoryReviewers)
      .where(
        and(
          inArray(categoryReviewers.taxonomyTermId, oldTermIds),
          eq(categoryReviewers.processInstanceId, instanceId),
        ),
      ),
  ]);

  if (linkSnapshot.length === 0 && scopeSnapshot.length === 0) {
    return;
  }

  const proposalIds = [...new Set(linkSnapshot.map((link) => link.proposalId))];

  if (linkSnapshot.length > 0) {
    // Delete before insert: with a swap, inserting first would then delete the
    // rows just written. Deleting by (old term, snapshot proposal) can only
    // match pairs that are in the snapshot, since the snapshot already holds
    // every old-term row belonging to these proposals.
    await tx
      .delete(proposalCategories)
      .where(
        and(
          inArray(proposalCategories.taxonomyTermId, oldTermIds),
          inArray(proposalCategories.proposalId, proposalIds),
        ),
      );

    // Idempotent on the composite PK (proposalId, taxonomyTermId): a proposal
    // may already carry the new term (e.g. tagged after the rename).
    await tx
      .insert(proposalCategories)
      .values(
        linkSnapshot.map((link) => ({
          proposalId: link.proposalId,
          taxonomyTermId: newTermIdByOldTermId.get(link.taxonomyTermId)!,
        })),
      )
      .onConflictDoNothing();
  }

  if (scopeSnapshot.length > 0) {
    // Same delete-then-insert, keyed on the surrogate id. An UPDATE would risk
    // `category_reviewers_unique` when the reviewer already covers the new
    // term, and drizzle can't express onConflictDoNothing for an update.
    await tx.delete(categoryReviewers).where(
      inArray(
        categoryReviewers.id,
        scopeSnapshot.map((scope) => scope.id),
      ),
    );

    await tx
      .insert(categoryReviewers)
      .values(
        scopeSnapshot.map((scope) => ({
          processInstanceId: instanceId,
          taxonomyTermId: newTermIdByOldTermId.get(scope.taxonomyTermId)!,
          reviewerProfileId: scope.reviewerProfileId,
          phaseId: scope.phaseId,
        })),
      )
      .onConflictDoNothing();
  }

  await migrateProposalDataLabels({ tx, proposalIds, renames: resolved });

  logger.info('Re-pointed category-keyed rows after category rename', {
    instanceId,
    renameCount: resolved.length,
    proposalCount: proposalIds.length,
    scopeRowCount: scopeSnapshot.length,
  });

  // Assignments are derived from scope rows ⨝ proposal categories, so both
  // sides having moved is not enough — proposals already on the new term gain
  // the arriving reviewers. Reconciling by the new term covers the moved and
  // pre-existing proposals in one pass.
  for (const newTermId of new Set(resolved.map((r) => r.newTermId))) {
    await reconcileReviewAssignments({
      db: tx,
      instanceId,
      affected: { taxonomyTermId: newTermId },
    });
  }
}

/**
 * Resolves each rename's old and new taxonomy term in a single lookup, dropping
 * renames with nothing to move.
 */
async function resolveRenames({
  tx,
  instanceId,
  renames,
}: {
  tx: DbClient;
  instanceId: string;
  renames: CategoryRename[];
}): Promise<ResolvedRename[]> {
  // A case/whitespace-only edit slugs to the same term — nothing to move. The
  // term keeps the old label text, which is a separate (pre-existing) problem.
  const slugChanging = renames.filter(
    ({ oldLabel, newLabel }) =>
      categoryTermUri(oldLabel) !== categoryTermUri(newLabel),
  );
  if (slugChanging.length === 0) {
    return [];
  }

  const termUris = slugChanging.flatMap(({ oldLabel, newLabel }) => [
    categoryTermUri(oldLabel),
    categoryTermUri(newLabel),
  ]);

  // taxonomyTerms V2 types are broken due to self-referential parentId, so use
  // the v1 `_query` builder (as elsewhere in this service).
  const terms = await tx._query.taxonomyTerms.findMany({
    where: inArray(taxonomyTerms.termUri, termUris),
  });
  const termIdByUri = new Map(terms.map((term) => [term.termUri, term.id]));

  return slugChanging.flatMap((rename) => {
    const oldTermId = termIdByUri.get(categoryTermUri(rename.oldLabel));
    const newTermId = termIdByUri.get(categoryTermUri(rename.newLabel));

    // No old term means nothing was ever tagged with the old label.
    if (!oldTermId) {
      return [];
    }

    // No new term means creation didn't run — the caller ensures it, so this
    // should be unreachable. Warn rather than skip silently: the config now
    // holds the new label, so the rows are left orphaned on the old term.
    if (!newTermId) {
      logger.warn(
        'Category rename reconciliation skipped: new taxonomy term not found',
        { instanceId, oldLabel: rename.oldLabel, newLabel: rename.newLabel },
      );
      return [];
    }

    return [{ ...rename, oldTermId, newTermId }];
  });
}

/**
 * Rewrites the renamed labels inside each affected proposal's
 * `proposalData.category`.
 *
 * The junction is not the only copy of a category: `proposalData` stores the
 * labels, `setProposalCategories` resolves them by exact `taxonomyTerms.label`,
 * and `updateProposal` re-runs that resolution on any `proposalData` write. Left
 * stale, an ordinary draft edit (a title tweak, an autosave) would re-resolve
 * the old label and move the link straight back to the old term.
 */
async function migrateProposalDataLabels({
  tx,
  proposalIds,
  renames,
}: {
  tx: DbClient;
  proposalIds: string[];
  renames: ResolvedRename[];
}): Promise<void> {
  if (proposalIds.length === 0) {
    return;
  }

  const newLabelByOldLabel = new Map(
    renames.map(({ oldLabel, newLabel }) => [oldLabel, newLabel]),
  );

  const rows = await tx
    .select({ id: proposals.id, proposalData: proposals.proposalData })
    .from(proposals)
    .where(inArray(proposals.id, proposalIds));

  for (const row of rows) {
    const proposalData = row.proposalData;
    if (typeof proposalData !== 'object' || proposalData === null) {
      continue;
    }

    const data: Record<string, unknown> = { ...proposalData };
    // `category` is `string | string[] | null` before normalization.
    const category = data.category;
    const labels =
      typeof category === 'string'
        ? [category]
        : Array.isArray(category)
          ? category
          : [];

    const migrated = labels.map((label) =>
      typeof label === 'string'
        ? (newLabelByOldLabel.get(label) ?? label)
        : label,
    );

    const changed = migrated.some((label, index) => label !== labels[index]);
    if (!changed) {
      continue;
    }

    await tx
      .update(proposals)
      .set({
        proposalData: {
          ...data,
          category: typeof category === 'string' ? migrated[0] : migrated,
        },
      })
      .where(eq(proposals.id, row.id));
  }
}
