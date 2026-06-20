import { db, inArray } from '@op/db/client';
import { posts } from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import { TestOrganizationDataManager } from '../../test/helpers/TestOrganizationDataManager';
import {
  accessTierGatingCell,
  describeAccessTierGating,
  expectFailsAccessTierGate,
  expectPassesAccessTierGate,
} from '../../test/helpers/gating';
import { createAuthenticatedCaller } from '../../test/supabase-utils';

describeAccessTierGating('organization.listAllPosts', {
  noJwt: accessTierGatingCell('rejects no-JWT caller', async ({ callers }) => {
    const caller = await callers.noJwt();
    await expectFailsAccessTierGate(caller.organization.listAllPosts(), 'none');
  }),

  anonJwt: accessTierGatingCell(
    'rejects anon-JWT caller',
    async ({ callers }) => {
      const caller = await callers.anonJwt();
      await expectFailsAccessTierGate(
        caller.organization.listAllPosts(),
        'anon',
      );
    },
  ),

  userJwt: accessTierGatingCell(
    'rejects user-JWT caller',
    async ({ callers }) => {
      const caller = await callers.userJwt();
      await expectFailsAccessTierGate(
        caller.organization.listAllPosts(),
        'user',
      );
    },
  ),

  networkJwt: accessTierGatingCell(
    'admits network-JWT caller',
    async ({ callers }) => {
      const caller = await callers.networkJwt();
      await expectPassesAccessTierGate(caller.organization.listAllPosts());
    },
  ),
});

// Regression for the landing-feed infinite-scroll loop: the v2 relational
// query aliases `posts_to_organizations` to `d0`, so a cursor condition built
// from the un-aliased schema reference errors with "invalid reference to
// FROM-clause entry" on every page past the first. react-query retried, the
// trigger stayed in view, and the client looped until rate-limited.
describe.concurrent('organization.listAllPosts pagination', () => {
  it('walks the cursor to completion without re-fetching the same page', async ({
    task,
    onTestFinished,
  }) => {
    const data = new TestOrganizationDataManager(task.id, onTestFinished);
    const { organization, adminUser } = await data.createOrganization({
      users: { admin: 1 },
    });
    const caller = await createAuthenticatedCaller(adminUser.email);

    const createdIds: string[] = [];
    for (let i = 0; i < 7; i++) {
      const post = await caller.organization.createPost({
        id: organization.id,
        content: `pagination-test post #${i}`,
      });
      createdIds.push(post.id);
    }
    onTestFinished(async () => {
      await db.delete(posts).where(inArray(posts.id, createdIds));
    });

    const limit = 3;
    const seen: string[] = [];
    let cursor: string | null | undefined;
    let pages = 0;
    while (pages++ < 20) {
      const page = await caller.organization.listAllPosts({ limit, cursor });
      seen.push(...page.items.map((it) => it.postId));
      if (!page.next) {
        break;
      }
      cursor = page.next;
    }

    expect(pages).toBeLessThan(20);
    expect(seen.filter((id) => createdIds.includes(id))).toEqual(
      createdIds.slice().reverse(),
    );
  });
});
