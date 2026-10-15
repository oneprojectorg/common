import { TestOrganizationDataManager } from '@op/common/testing';
import { db, inArray } from '@op/db/client';
import {
  organizationsStrategies,
  organizationsTerms,
  taxonomies,
  taxonomyTerms,
} from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import { listOrganizationFilterTerms } from './listOrganizationFilterTerms';

describe.concurrent('listOrganizationFilterTerms', () => {
  it('returns only the terms an organization is tagged with, by label', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);
    const focusNamespace = `focus-${task.id}`;
    const strategyNamespace = `strategy-${task.id}`;

    const [focusTaxonomy, strategyTaxonomy] = await db
      .insert(taxonomies)
      .values([
        { name: focusNamespace, namespaceUri: focusNamespace },
        { name: strategyNamespace, namespaceUri: strategyNamespace },
      ])
      .returning({ id: taxonomies.id });
    if (!focusTaxonomy || !strategyTaxonomy) {
      throw new Error('Failed to insert taxonomy fixtures');
    }

    // Deleting the terms cascades to organizations_terms/_strategies.
    const taxonomyIds = [focusTaxonomy.id, strategyTaxonomy.id];
    onTestFinished(async () => {
      await db
        .delete(taxonomyTerms)
        .where(inArray(taxonomyTerms.taxonomyId, taxonomyIds));
      await db.delete(taxonomies).where(inArray(taxonomies.id, taxonomyIds));
    });

    const fixtures: [string, string, string | null][] = [
      [focusTaxonomy.id, 'B', 'focusArea'],
      [focusTaxonomy.id, 'A', 'focusArea'],
      [focusTaxonomy.id, 'C', 'focusArea'], // never tagged
      [focusTaxonomy.id, 'D', 'other'],
      [strategyTaxonomy.id, 'S', null],
      [strategyTaxonomy.id, 'T', null], // tagged via organizations_terms only
    ];
    const terms = await db
      .insert(taxonomyTerms)
      .values(
        fixtures.map(([taxonomyId, label, facet]) => ({
          taxonomyId,
          termUri: label,
          label,
          facet,
        })),
      )
      .returning({ id: taxonomyTerms.id });
    const [focusB, focusA, , focusOtherFacet, strategy, strategyInTermsTable] =
      terms;
    if (
      !focusB ||
      !focusA ||
      !focusOtherFacet ||
      !strategy ||
      !strategyInTermsTable
    ) {
      throw new Error('Failed to insert taxonomy term fixtures');
    }

    const { organization } = await testData.createOrganization({
      users: { admin: 1 },
    });
    const tag = (term: { id: string }) => ({
      organizationId: organization.id,
      taxonomyTermId: term.id,
    });
    await Promise.all([
      db
        .insert(organizationsTerms)
        .values(
          [focusB, focusA, focusOtherFacet, strategyInTermsTable].map(tag),
        ),
      db.insert(organizationsStrategies).values(tag(strategy)),
    ]);

    const result = await listOrganizationFilterTerms({
      focusAreaTaxonomy: { namespaceUri: focusNamespace, facet: 'focusArea' },
      strategyTaxonomy: { namespaceUri: strategyNamespace },
    });

    expect(result).toEqual({
      focusAreas: [
        { id: focusA.id, label: 'A' },
        { id: focusB.id, label: 'B' },
      ],
      strategies: [{ id: strategy.id, label: 'S' }],
    });
  });
});
