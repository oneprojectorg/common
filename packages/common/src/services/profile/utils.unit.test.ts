import { beforeEach, describe, expect, it, vi } from 'vitest';

import { generateUniqueProfileSlug } from './utils';

// The slugs already taken, as the select would return them.
let existingRows: Array<{ slug: string }> = [];

// `@op/db/client` pulls in `server-only`, which Vitest can't load. Stub the
// one select this function performs.
vi.mock('@op/db/client', () => ({
  db: {
    select: () => ({
      from: () => ({ where: () => Promise.resolve(existingRows) }),
    }),
  },
}));

describe('generateUniqueProfileSlug', () => {
  beforeEach(() => {
    existingRows = [];
  });

  it('slugifies a free name', async () => {
    await expect(
      generateUniqueProfileSlug({ name: 'Budget 2026' }),
    ).resolves.toBe('budget-2026');
  });

  it('skips a slug that a static route would shadow', async () => {
    await expect(generateUniqueProfileSlug({ name: 'New' })).resolves.toBe(
      'new-2',
    );
  });

  it('moves past a taken suffix of a reserved slug', async () => {
    existingRows = [{ slug: 'new-2' }];

    await expect(generateUniqueProfileSlug({ name: 'New' })).resolves.toBe(
      'new-3',
    );
  });
});
