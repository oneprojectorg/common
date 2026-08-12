import { db } from '@op/db/client';
import { profileUsers } from '@op/db/schema';
import type { SQL } from 'drizzle-orm';
import { asc, desc } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { decodeCursor, encodeCursor } from '../../utils/db';
import { assertProfile, assertProfileAdmin } from '../assert';
import { listProfileUsers } from './listProfileUsers';

// `@op/db/client` pulls in `server-only`, which Vitest blocks. Stub the `db`
// handle and re-export the real drizzle query builders so the SQL this service
// generates is the SQL we assert on. `@op/db/schema` is deliberately NOT
// mocked — the assertions below depend on real column and table names.
vi.mock('@op/db/client', async () => {
  const drizzle =
    await vi.importActual<typeof import('drizzle-orm')>('drizzle-orm');

  return {
    ...drizzle,
    db: {
      _query: {
        profileUsers: { findMany: vi.fn() },
      },
    },
  };
});

vi.mock('../assert', () => ({
  assertProfile: vi.fn(),
  assertProfileAdmin: vi.fn(),
}));

const PROFILE_ID = '00000000-0000-4000-8000-000000000001';
const USER = {
  id: 'auth-user-1',
  email: 'admin@example.test',
} as Parameters<typeof listProfileUsers>[0]['user'];

const mockFindMany = vi.mocked(db._query.profileUsers.findMany);
// Match the runtime client, which is built with `casing: 'snake_case'`.
const dialect = new PgDialect({ casing: 'snake_case' });

const toSqlString = (query: SQL): string => dialect.sqlToQuery(query).sql;

/** Normalizes the indentation the `sql` templates carry into their output. */
const collapse = (sqlText: string): string =>
  sqlText.replace(/\s+/g, ' ').trim();

/**
 * A profile user whose denormalized `profile_users.name` disagrees with the
 * name the API actually returns — the shape that made the Name column look
 * unsorted in the participants table.
 */
const buildRow = ({
  id,
  denormalizedName,
  profileName,
  email,
}: {
  id: string;
  denormalizedName: string | null;
  profileName: string | null;
  email: string;
}) => ({
  id,
  authUserId: `auth-${id}`,
  profileId: PROFILE_ID,
  name: denormalizedName,
  email,
  about: null,
  isOwner: false,
  roles: [],
  serviceUser: profileName
    ? { profile: { id: `profile-${id}`, name: profileName, bio: null } }
    : null,
});

/** The ORDER BY expressions the service handed to the query builder. */
const captureOrderBy = (): Array<SQL> => {
  const [args] = mockFindMany.mock.calls[0] ?? [];
  const orderBy = args?.orderBy;

  if (typeof orderBy !== 'function') {
    throw new Error('expected listProfileUsers to pass an orderBy callback');
  }

  return orderBy(profileUsers, { asc, desc });
};

describe('listProfileUsers — name sort matches the displayed name', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(assertProfile).mockResolvedValue(undefined as never);
    vi.mocked(assertProfileAdmin).mockResolvedValue(undefined as never);
    mockFindMany.mockResolvedValue([] as never);
  });

  it('orders by the linked profile name, not the denormalized column', async () => {
    await listProfileUsers({ profileId: PROFILE_ID, user: USER });

    const [primaryOrder] = captureOrderBy();
    const sqlText = toSqlString(primaryOrder!);

    expect(sqlText).toContain('"profiles"');
    expect(sqlText).not.toMatch(/^"profile_users"\."name"/);
  });

  it('falls back to the denormalized column for users with no profile', async () => {
    await listProfileUsers({ profileId: PROFILE_ID, user: USER });

    const [primaryOrder] = captureOrderBy();

    // Pinned in full: a substring check would still pass against a sort on the
    // bare `profile_users.name` column, and the exact COALESCE/NULLIF chain is
    // what has to keep matching `resolveDisplayName` for the cursor to line up
    // with the ORDER BY.
    expect(collapse(toSqlString(primaryOrder!))).toBe(
      collapse(`COALESCE(NULLIF((
        SELECT p.name
        FROM "users" u
        INNER JOIN "profiles" p ON p.id = u.profile_id
        WHERE u.auth_user_id = "profile_users"."auth_user_id"
        ORDER BY p.name
        LIMIT 1
      ), ''), NULLIF("profile_users"."name", ''), '') asc`),
    );
  });

  it('paginates the name sort on the same expression it orders by', async () => {
    await listProfileUsers({
      profileId: PROFILE_ID,
      user: USER,
      cursor: encodeCursor({
        value: 'Beatrice',
        tiebreaker: '00000000-0000-4000-8000-0000000000b0',
      }),
    });

    const [args] = mockFindMany.mock.calls[0] ?? [];
    const whereText = collapse(toSqlString(args!.where as SQL));
    const [primaryOrder, secondaryOrder] = captureOrderBy();
    const sortKey = collapse(toSqlString(primaryOrder!)).replace(/ asc$/, '');

    // The cursor has to compare against the same expression the rows are
    // ordered by, or pagination skips and repeats rows at the page boundary.
    expect(whereText).toContain(sortKey);
    // …and tiebreak on the same column.
    expect(collapse(toSqlString(secondaryOrder!))).toBe(
      '"profile_users"."id" asc',
    );
    expect(whereText).toContain('"profile_users"."id"');
  });

  it('inlines the name sort key once in the cursor condition', async () => {
    await listProfileUsers({
      profileId: PROFILE_ID,
      user: USER,
      cursor: encodeCursor({
        value: 'Beatrice',
        tiebreaker: '00000000-0000-4000-8000-0000000000b0',
      }),
    });

    const [args] = mockFindMany.mock.calls[0] ?? [];
    const whereText = collapse(toSqlString(args!.where as SQL));
    const [primaryOrder] = captureOrderBy();
    const sortKey = collapse(toSqlString(primaryOrder!)).replace(/ asc$/, '');

    // The sort key is a correlated subquery and Postgres does no
    // common-subexpression elimination, so the row-wise comparison exists to
    // keep it from being evaluated twice per row on top of the ORDER BY.
    expect(whereText.split(sortKey)).toHaveLength(2);
  });

  it('tiebreaks the email sort on id and keeps null emails reachable', async () => {
    await listProfileUsers({
      profileId: PROFILE_ID,
      user: USER,
      orderBy: 'email',
      cursor: encodeCursor({
        value: 'b@example.test',
        tiebreaker: '00000000-0000-4000-8000-0000000000b0',
      }),
    });

    const [primaryOrder, secondaryOrder] = captureOrderBy();

    // Coalesced, or a participant with no email could never satisfy the
    // cursor comparison and would drop off after the first page.
    expect(collapse(toSqlString(primaryOrder!))).toBe(
      `COALESCE("profile_users"."email", '') asc`,
    );
    expect(collapse(toSqlString(secondaryOrder!))).toBe(
      '"profile_users"."id" asc',
    );
  });

  it('encodes the displayed name into the next cursor', async () => {
    mockFindMany.mockResolvedValue([
      buildRow({
        id: '1',
        denormalizedName: null,
        profileName: 'Alice Alpha',
        email: 'alice@example.test',
      }),
      buildRow({
        id: '2',
        denormalizedName: null,
        profileName: 'Bea Beta',
        email: 'bea@example.test',
      }),
    ] as never);

    const { next } = await listProfileUsers({
      profileId: PROFILE_ID,
      user: USER,
      limit: 1,
    });

    expect(next).not.toBeNull();
    expect(decodeCursor(next!)).toEqual({
      value: 'Alice Alpha',
      // `id`, not `email` — email is nullable and non-unique, so it can't
      // break ties reliably.
      tiebreaker: '1',
    });
  });
});
