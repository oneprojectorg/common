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
        { id: focusA.id, label: 'A', slug: 'a' },
        { id: focusB.id, label: 'B', slug: 'b' },
      ],
      strategies: [{ id: strategy.id, label: 'S', slug: 's' }],
    });
  });

  it('defaults to the focus-area and strategy taxonomies the app tags with', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);

    const [focusTaxonomy, strategyTaxonomy] = await db
      .insert(taxonomies)
      .values([
        { name: `necSimple-${task.id}`, namespaceUri: 'necSimple' },
        { name: `splcStrategies-${task.id}`, namespaceUri: 'splcStrategies' },
      ])
      .returning({ id: taxonomies.id });
    if (!focusTaxonomy || !strategyTaxonomy) {
      throw new Error('Failed to insert taxonomy fixtures');
    }
    const taxonomyIds = [focusTaxonomy.id, strategyTaxonomy.id];
    onTestFinished(async () => {
      await db
        .delete(taxonomyTerms)
        .where(inArray(taxonomyTerms.taxonomyId, taxonomyIds));
      await db.delete(taxonomies).where(inArray(taxonomies.id, taxonomyIds));
    });

    const [focusArea, strategy] = await db
      .insert(taxonomyTerms)
      .values([
        {
          taxonomyId: focusTaxonomy.id,
          termUri: `necSimple:energyAndUtilities${task.id}`,
          label: `Focus ${task.id}`,
          facet: 'focusArea',
        },
        {
          taxonomyId: strategyTaxonomy.id,
          termUri: `splc:DirectAction${task.id}`,
          label: `Strategy ${task.id}`,
        },
      ])
      .returning({ id: taxonomyTerms.id, label: taxonomyTerms.label });
    if (!focusArea || !strategy) {
      throw new Error('Failed to insert taxonomy term fixtures');
    }

    const { organization } = await testData.createOrganization({
      users: { admin: 1 },
    });
    await Promise.all([
      db.insert(organizationsTerms).values({
        organizationId: organization.id,
        taxonomyTermId: focusArea.id,
      }),
      db.insert(organizationsStrategies).values({
        organizationId: organization.id,
        taxonomyTermId: strategy.id,
      }),
    ]);

    const { focusAreas, strategies } = await listOrganizationFilterTerms();

    expect(focusAreas).toContainEqual({
      ...focusArea,
      slug: `energy-and-utilities${task.id}`.toLowerCase(),
    });
    expect(strategies).toContainEqual({
      ...strategy,
      slug: `direct-action${task.id}`.toLowerCase(),
    });
  });
});
