import { describe, expect, it } from 'vitest';

import {
  createOutsiderCaller,
  setupInstance,
} from '../../test/helpers/resourcesTestUtils';

const FIRST_URL = 'https://example.com/first';
const SECOND_URL = 'https://example.org/second';
const THIRD_URL = 'https://example.net/third';

describe('resources.listAcrossCollections', () => {
  it('returns an empty list when the profile has no collections', async ({
    task,
    onTestFinished,
  }) => {
    const { instance, adminCaller } = await setupInstance({
      task,
      onTestFinished,
    });

    const result = await adminCaller.resources.listAcrossCollections({
      profileId: instance.profileId,
    });

    expect(result.items).toEqual([]);
  });

  it('flattens resources across collections in (collection, item) order', async ({
    task,
    onTestFinished,
  }) => {
    const { instance, adminCaller } = await setupInstance({
      task,
      onTestFinished,
    });

    // Collections list in profile-link sortKey order: Alpha first, Beta second.
    const alpha = await adminCaller.resources.collections.create({
      profileId: instance.profileId,
      name: 'Alpha',
    });
    const beta = await adminCaller.resources.collections.create({
      profileId: instance.profileId,
      name: 'Beta',
    });

    // New resources land at the top of their collection, so Alpha reads
    // [alphaSecond, alphaFirst] and Beta reads [betaOnly].
    const alphaFirst = await adminCaller.resources.createLink({
      target: { kind: 'collection', collectionId: alpha.id },
      title: 'Alpha first',
      linkUrl: FIRST_URL,
    });
    const alphaSecond = await adminCaller.resources.createLink({
      target: { kind: 'collection', collectionId: alpha.id },
      title: 'Alpha second',
      linkUrl: SECOND_URL,
    });
    const betaOnly = await adminCaller.resources.createLink({
      target: { kind: 'collection', collectionId: beta.id },
      title: 'Beta only',
      linkUrl: THIRD_URL,
    });

    const collectionsOrder = await adminCaller.resources.collections.list({
      profileId: instance.profileId,
    });
    const expectedIdsByCollection = new Map([
      [alpha.id, [alphaSecond.id, alphaFirst.id]],
      [beta.id, [betaOnly.id]],
    ]);
    const expectedIds = collectionsOrder.items.flatMap(
      (collection) => expectedIdsByCollection.get(collection.id) ?? [],
    );

    const result = await adminCaller.resources.listAcrossCollections({
      profileId: instance.profileId,
    });

    expect(result.items.map((item) => item.id)).toEqual(expectedIds);
    // Each item carries the collection it came from.
    expect(
      result.items.find((item) => item.id === betaOnly.id)?.collectionId,
    ).toBe(beta.id);
  });

  it('rejects an outsider', async ({ task, onTestFinished }) => {
    const { testData, instance, adminCaller } = await setupInstance({
      task,
      onTestFinished,
    });
    await adminCaller.resources.createLink({
      target: { kind: 'profile', profileId: instance.profileId },
      title: 'Members only',
      linkUrl: FIRST_URL,
    });
    const { caller: outsiderCaller } = await createOutsiderCaller(testData);

    await expect(
      outsiderCaller.resources.listAcrossCollections({
        profileId: instance.profileId,
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
  });
});
