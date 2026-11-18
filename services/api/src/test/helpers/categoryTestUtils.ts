import { db, eq, inArray } from '@op/db/client';
import { processInstances, taxonomies, taxonomyTerms } from '@op/db/schema';
import { randomUUID } from 'node:crypto';

/**
 * Creates the shared "proposal" taxonomy (if absent) and appends the given
 * terms. Labels are made unique per call so concurrent tests don't collide on
 * the (taxonomyId, termUri) unique constraint.
 */
export async function seedProposalTaxonomy(
  termLabels: string[],
  onTestFinished: (fn: () => void | Promise<void>) => void,
) {
  const taxonomyId = randomUUID();

  const [inserted] = await db
    .insert(taxonomies)
    .values({ id: taxonomyId, name: 'proposal' })
    .onConflictDoNothing({ target: taxonomies.name })
    .returning({ id: taxonomies.id });

  let resolvedTaxonomyId: string;

  if (inserted) {
    resolvedTaxonomyId = inserted.id;
  } else {
    const [existing] = await db
      .select({ id: taxonomies.id })
      .from(taxonomies)
      .where(eq(taxonomies.name, 'proposal'));
    if (!existing) {
      throw new Error('proposal taxonomy not found after conflict');
    }
    resolvedTaxonomyId = existing.id;
  }

  const termRecords = termLabels.map((label) => ({
    id: randomUUID(),
    taxonomyId: resolvedTaxonomyId,
    termUri: label
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, ''),
    label,
  }));

  if (termRecords.length > 0) {
    await db.insert(taxonomyTerms).values(termRecords);
  }

  onTestFinished(async () => {
    if (termRecords.length > 0) {
      await db.delete(taxonomyTerms).where(
        inArray(
          taxonomyTerms.id,
          termRecords.map((t) => t.id),
        ),
      );
    }
  });

  return termRecords;
}

/** Injects config.categories into an existing process instance's instanceData. */
export async function injectInstanceCategories(
  instanceId: string,
  categories: Array<{ id: string; label: string; description: string }>,
) {
  const [instance] = await db
    .select({ instanceData: processInstances.instanceData })
    .from(processInstances)
    .where(eq(processInstances.id, instanceId));

  if (!instance) {
    throw new Error(`Instance ${instanceId} not found`);
  }

  const instanceData = instance.instanceData as Record<string, unknown>;
  await db
    .update(processInstances)
    .set({
      instanceData: {
        ...instanceData,
        config: {
          ...((instanceData.config as Record<string, unknown>) ?? {}),
          categories,
        },
      },
    })
    .where(eq(processInstances.id, instanceId));
}

/** Two uniquely-labeled category terms plus the config labels that match them. */
export async function seedTwoCategories(
  onTestFinished: (fn: () => void | Promise<void>) => void,
) {
  const suffix = randomUUID().slice(0, 8);
  const labels = [`Category ${suffix} A`, `Category ${suffix} B`];
  const terms = await seedProposalTaxonomy(labels, onTestFinished);
  return {
    labels,
    terms,
    configCategories: labels.map((label, i) => ({
      id: `cat-${i}`,
      label,
      description: `${label} proposals`,
    })),
  };
}
