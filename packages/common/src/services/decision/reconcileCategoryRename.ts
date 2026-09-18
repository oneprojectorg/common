import { type DbClient, and, eq, inArray } from '@op/db/client';
import {
  categoryReviewers,
  proposalCategories,
  proposals,
  taxonomies,
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
  /** The old term's own `label`, which may differ in text from `oldLabel`. */
  oldTermLabel: string;
  /** The new term's own `label`, which may differ in text from `newLabel`. */
  newTermLabel: string;
}

/**
 * Detects category renames between two config category arrays.
 *
 * Keys on the config-local `id`: a category present before with the same id but
 * a different label was renamed, whereas delete + add changes the id. Pure, so
 * it's testable without a database.
 *
 * Drops a rename whose old label is still carried by a category that is *not*
 * itself being renamed away. Labels are not unique in the config, so the old
 * taxonomy term then stays in use and its rows can't be attributed to the
 * renamed category — moving them would steal the other category's proposals. A
 * swap (`A→B`, `B→A`) is not this case: there the other holder of A is itself a
 * rename source, so its own old term moves too.
 */
export function detectCategoryRenames(
  previous: ProposalCategory[],
  next: ProposalCategory[],
): CategoryRename[] {
  const previousLabelById = new Map(
    previous.map((category) => [category.id, category.label]),
  );

  const isRenamed = (category: ProposalCategory): boolean => {
    const previousLabel = previousLabelById.get(category.id);
    return previousLabel !== undefined && previousLabel !== category.label;
  };

  // Compared by slug, not text: a case-only difference resolves to one term.
  const retainedSlugs = new Set(
    next
      .filter((category) => !isRenamed(category))
      .map((category) => categoryTermUri(category.label)),
  );

  return next.flatMap((category) => {
    const previousLabel = previousLabelById.get(category.id);
    if (previousLabel === undefined || previousLabel === category.label) {
      return [];
    }
    if (retainedSlugs.has(categoryTermUri(previousLabel))) {
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
  const [linkRows, scopeRows] = await Promise.all([
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

  // Pair each snapshot row with its destination term now, while the snapshot is
  // still the only source of truth: this fixes the set of rows the renames may
  // move, so a cascade or a swap can't sweep a row twice.
  const linkSnapshot = withNewTermId(linkRows, newTermIdByOldTermId, {
    instanceId,
    table: 'decision_categories',
  });
  const scopeSnapshot = withNewTermId(scopeRows, newTermIdByOldTermId, {
    instanceId,
    table: 'decision_category_reviewers',
  });

  if (linkSnapshot.length === 0 && scopeSnapshot.length === 0) {
    return;
  }

  const snapshotProposalIds = [
    ...new Set(linkSnapshot.map((link) => link.proposalId)),
  ];

  let proposalIds: string[] = [];
  let movedScopeRowCount = 0;

  if (linkSnapshot.length > 0) {
    // Delete before insert: with a swap, inserting first would then delete the
    // rows just written. The snapshot decides which (old term, proposal) pairs
    // are candidates; RETURNING then reports which of them the delete actually
    // removed, so a row a concurrent `updateProposal` re-tagged in the meantime
    // is not re-created from the stale snapshot.
    const removedLinks = await tx
      .delete(proposalCategories)
      .where(
        and(
          inArray(proposalCategories.taxonomyTermId, oldTermIds),
          inArray(proposalCategories.proposalId, snapshotProposalIds),
        ),
      )
      .returning({
        proposalId: proposalCategories.proposalId,
        taxonomyTermId: proposalCategories.taxonomyTermId,
      });

    const movedLinks = withNewTermId(removedLinks, newTermIdByOldTermId, {
      instanceId,
      table: 'decision_categories',
    });
    proposalIds = [...new Set(movedLinks.map((link) => link.proposalId))];

    if (movedLinks.length > 0) {
      // Idempotent on the composite PK (proposalId, taxonomyTermId): a proposal
      // may already carry the new term (e.g. tagged after the rename).
      await tx
        .insert(proposalCategories)
        .values(
          movedLinks.map((link) => ({
            proposalId: link.proposalId,
            taxonomyTermId: link.newTermId,
          })),
        )
        .onConflictDoNothing();
    }
  }

  if (scopeSnapshot.length > 0) {
    // Same delete-then-re-insert-what-was-removed, keyed on the surrogate id.
    // An UPDATE would risk `category_reviewers_unique` when the reviewer
    // already covers the new term, and drizzle can't express
    // onConflictDoNothing for an update.
    const removedScopes = await tx
      .delete(categoryReviewers)
      .where(
        inArray(
          categoryReviewers.id,
          scopeSnapshot.map((scope) => scope.id),
        ),
      )
      .returning({
        taxonomyTermId: categoryReviewers.taxonomyTermId,
        reviewerProfileId: categoryReviewers.reviewerProfileId,
        phaseId: categoryReviewers.phaseId,
      });

    const movedScopes = withNewTermId(removedScopes, newTermIdByOldTermId, {
      instanceId,
      table: 'decision_category_reviewers',
    });
    movedScopeRowCount = movedScopes.length;

    if (movedScopes.length > 0) {
      await tx
        .insert(categoryReviewers)
        .values(
          movedScopes.map((scope) => ({
            processInstanceId: instanceId,
            taxonomyTermId: scope.newTermId,
            reviewerProfileId: scope.reviewerProfileId,
            phaseId: scope.phaseId,
          })),
        )
        .onConflictDoNothing();
    }
  }

  await migrateProposalDataLabels({ tx, proposalIds, renames: resolved });

  logger.info('Re-pointed category-keyed rows after category rename', {
    instanceId,
    renameCount: resolved.length,
    proposalCount: proposalIds.length,
    scopeRowCount: movedScopeRowCount,
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
 * Pairs each row with the term it moves to. Every row handed here — snapshot or
 * delete-returned — was matched on the map's own keys, so a miss is
 * unreachable: warn rather than drop it silently.
 */
function withNewTermId<T extends { taxonomyTermId: string }>(
  rows: T[],
  newTermIdByOldTermId: Map<string, string>,
  context: { instanceId: string; table: string },
): (T & { newTermId: string })[] {
  return rows.flatMap((row) => {
    const newTermId = newTermIdByOldTermId.get(row.taxonomyTermId);
    if (!newTermId) {
      logger.warn('Category rename reconciliation skipped a row: no new term', {
        ...context,
        oldTermId: row.taxonomyTermId,
      });
      return [];
    }
    return [{ ...row, newTermId }];
  });
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

  // Scope to the `proposal` taxonomy, the same way `setProposalCategories`
  // does: `termUri` is only unique within a taxonomy.
  const proposalTaxonomy = await tx._query.taxonomies.findFirst({
    where: eq(taxonomies.name, 'proposal'),
  });

  if (!proposalTaxonomy) {
    logger.warn(
      'Category rename reconciliation skipped: no "proposal" taxonomy found',
      { instanceId },
    );
    return [];
  }

  // taxonomyTerms V2 types are broken due to self-referential parentId, so use
  // the v1 `_query` builder (as elsewhere in this service).
  const terms = await tx._query.taxonomyTerms.findMany({
    where: and(
      inArray(taxonomyTerms.termUri, termUris),
      eq(taxonomyTerms.taxonomyId, proposalTaxonomy.id),
    ),
  });
  const termByUri = new Map(terms.map((term) => [term.termUri, term]));

  const resolved = slugChanging.flatMap((rename) => {
    const oldTerm = termByUri.get(categoryTermUri(rename.oldLabel));
    const newTerm = termByUri.get(categoryTermUri(rename.newLabel));

    // No old term means nothing was ever tagged with the old label.
    if (!oldTerm) {
      return [];
    }

    // No new term means creation didn't run — the caller ensures it, so this
    // should be unreachable. Warn rather than skip silently: the config now
    // holds the new label, so the rows are left orphaned on the old term.
    if (!newTerm) {
      logger.warn(
        'Category rename reconciliation skipped: new taxonomy term not found',
        { instanceId, oldLabel: rename.oldLabel, newLabel: rename.newLabel },
      );
      return [];
    }

    return [
      {
        ...rename,
        oldTermId: oldTerm.id,
        newTermId: newTerm.id,
        oldTermLabel: oldTerm.label,
        newTermLabel: newTerm.label,
      },
    ];
  });

  // The config permits two categories with the same label, so two renames can
  // claim the same old term. Which rows belong to which destination is then
  // undefined, and last-write-wins would move them arbitrarily — drop every
  // rename sharing that old term and leave its rows where they are. (Two
  // renames arriving at the same NEW term from different old terms is a merge,
  // which is well defined.)
  const renameCountByOldTermId = new Map<string, number>();
  for (const rename of resolved) {
    renameCountByOldTermId.set(
      rename.oldTermId,
      (renameCountByOldTermId.get(rename.oldTermId) ?? 0) + 1,
    );
  }

  const ambiguousOldTermIds = new Set(
    [...renameCountByOldTermId]
      .filter(([, count]) => count > 1)
      .map(([oldTermId]) => oldTermId),
  );

  if (ambiguousOldTermIds.size === 0) {
    return resolved;
  }

  logger.warn(
    'Category rename reconciliation skipped: one taxonomy term claimed by several renames',
    {
      instanceId,
      renames: resolved
        .filter((rename) => ambiguousOldTermIds.has(rename.oldTermId))
        .map(({ oldLabel, newLabel }) => ({ oldLabel, newLabel })),
    },
  );

  return resolved.filter(
    (rename) => !ambiguousOldTermIds.has(rename.oldTermId),
  );
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
 *
 * Writes the *term's* label, not the config's: a rename can slug onto a term
 * another decision already minted with different text ("affordable housing" →
 * "Affordable Housing"), and only the term's own text re-resolves.
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

  // Key on the config's old label AND the old term's own text: a previous
  // reconcile wrote the term's label into the copy, and `setProposalCategories`
  // only resolves exact term labels, so the two can differ ("affordable
  // housing" in the config, "Affordable Housing" in the stored copy).
  const newLabelByOldLabel = new Map<string, string>();
  for (const { oldLabel, oldTermLabel, newTermLabel } of renames) {
    newLabelByOldLabel.set(oldLabel, newTermLabel);
    newLabelByOldLabel.set(oldTermLabel, newTermLabel);
  }

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

    // A proposal already tagged with both the old and the new label collapses
    // onto one entry, so the rewrite can't duplicate it.
    const deduped = migrated.filter(
      (label, index) => migrated.indexOf(label) === index,
    );

    const changed =
      deduped.length !== labels.length ||
      deduped.some((label, index) => label !== labels[index]);
    if (!changed) {
      continue;
    }

    await tx
      .update(proposals)
      .set({
        proposalData: {
          ...data,
          category: typeof category === 'string' ? deduped[0] : deduped,
        },
      })
      .where(eq(proposals.id, row.id));
  }
}
