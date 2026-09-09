import { beforeEach, describe, expect, it, vi } from 'vitest';

// `@op/db/client` / `@op/db/schema` pull in `server-only`, which Vitest can't
// load. We only need the query-builder helpers (`eq`/`sql`) and table handles to
// exist so the source's `where`/`values` clauses construct cleanly; the fake
// `tx` below stands in for the real DbClient.
vi.mock('@op/db/client', () => ({
  eq: vi.fn((...args: unknown[]) => ({ op: 'eq', args })),
  // Reproduce the value-capturing shape of drizzle's `sql` tag closely enough
  // that the serialized fragment carries the interpolated coordinates.
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
    op: 'sql',
    strings: [...strings],
    values,
  }),
}));

vi.mock('@op/db/schema', () => ({
  locations: { placeId: 'locations.placeId' },
  profilesLocations: { profileId: 'profilesLocations.profileId' },
}));

import { type DbClient } from '@op/db/client';

import { syncProposalProfileLocation } from './syncProposalProfileLocation';

/**
 * Records every insert/delete the function issues against a fake `tx`, so we can
 * assert on the place id / coordinates written without a real database.
 *
 * The real chains are:
 *   tx.delete(table).where(...)                                  -> awaited
 *   tx.insert(locations).values(...).onConflictDoUpdate(...).returning() -> [row]
 *   tx.insert(profilesLocations).values(...).onConflictDoNothing()       -> awaited
 */
interface InsertCall {
  values: Record<string, unknown>;
}

function makeTx(insertedRow: { id: string } | null = { id: 'loc-1' }) {
  const deleteCalls: { where: unknown }[] = [];
  const insertCalls: InsertCall[] = [];

  const tx = {
    delete: vi.fn(() => ({
      where: (where: unknown) => {
        deleteCalls.push({ where });
        return Promise.resolve(undefined);
      },
    })),
    insert: vi.fn(() => ({
      values: (values: Record<string, unknown>) => {
        const call: InsertCall = { values };
        insertCalls.push(call);
        return {
          // locations branch
          onConflictDoUpdate: () => ({
            returning: () => Promise.resolve(insertedRow ? [insertedRow] : []),
          }),
          // profilesLocations branch
          onConflictDoNothing: () => Promise.resolve(undefined),
        };
      },
    })),
  };

  return {
    tx: tx as unknown as DbClient,
    deleteCalls,
    insertCalls,
  };
}

const PROFILE_ID = 'profile-123';

describe('syncProposalProfileLocation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('clears the existing join then inserts a location + join for a valid place', async () => {
    const { tx, deleteCalls, insertCalls } = makeTx();

    await syncProposalProfileLocation(tx, PROFILE_ID, {
      location: {
        lat: 39.96,
        lng: -82.99,
        address: '123 Main St',
        placeId: 'gplace-abc',
      },
    });

    // Always clears the profile's existing join first.
    expect(deleteCalls).toHaveLength(1);

    // Inserts the location row, then the join row.
    expect(insertCalls).toHaveLength(2);

    const [locationInsert, joinInsert] = insertCalls;
    expect(locationInsert.values).toMatchObject({
      placeId: 'gplace-abc',
      address: '123 Main St',
    });
    expect(joinInsert.values).toEqual({
      profileId: PROFILE_ID,
      locationId: 'loc-1',
    });
  });

  it('uses the geocoded placeId when present', async () => {
    const { tx, insertCalls } = makeTx();

    await syncProposalProfileLocation(tx, PROFILE_ID, {
      location: { lat: 1, lng: 2, placeId: 'gplace-xyz' },
    });

    expect(insertCalls[0]?.values.placeId).toBe('gplace-xyz');
  });

  it('falls back to a synthetic place id keyed by the profile when placeId is absent', async () => {
    const { tx, insertCalls } = makeTx();

    await syncProposalProfileLocation(tx, PROFILE_ID, {
      location: { lat: 1, lng: 2 },
    });

    expect(insertCalls[0]?.values.placeId).toBe(
      `proposal-location:${PROFILE_ID}`,
    );
  });

  it('prefers placeLat/placeLng over the exact pin for the canonical point', async () => {
    const { tx, insertCalls } = makeTx();

    await syncProposalProfileLocation(tx, PROFILE_ID, {
      location: {
        lat: 10,
        lng: 20,
        placeLat: 11,
        placeLng: 21,
        placeId: 'gplace-1',
      },
    });

    // The point is built via a `sql` fragment over placeLng/placeLat; assert the
    // serialized fragment carries the place coordinate, not the pin.
    const fragment = JSON.stringify(insertCalls[0]?.values.location);
    expect(fragment).toContain('21');
    expect(fragment).toContain('11');
    expect(fragment).not.toContain('20');
    expect(fragment).not.toContain('10');
  });

  it('falls back to the exact pin coordinate when placeLat/placeLng are absent', async () => {
    const { tx, insertCalls } = makeTx();

    await syncProposalProfileLocation(tx, PROFILE_ID, {
      location: { lat: 33, lng: 44 },
    });

    const fragment = JSON.stringify(insertCalls[0]?.values.location);
    expect(fragment).toContain('44');
    expect(fragment).toContain('33');
  });

  it('skips the join insert when the location upsert returns no row', async () => {
    const { tx, deleteCalls, insertCalls } = makeTx(null);

    await syncProposalProfileLocation(tx, PROFILE_ID, {
      location: { lat: 1, lng: 2, placeId: 'gplace-1' },
    });

    expect(deleteCalls).toHaveLength(1);
    // Only the location insert ran; the guarded join insert did not.
    expect(insertCalls).toHaveLength(1);
  });

  it('clears the link and inserts nothing for a malformed location (does not throw)', async () => {
    const { tx, deleteCalls, insertCalls } = makeTx();

    await syncProposalProfileLocation(tx, PROFILE_ID, {
      // Out of range -> normalizeLocation returns undefined.
      location: { lat: 999, lng: 999 },
    });

    expect(deleteCalls).toHaveLength(1);
    expect(insertCalls).toHaveLength(0);
  });

  it('clears the link and inserts nothing when location is absent', async () => {
    const { tx, deleteCalls, insertCalls } = makeTx();

    await syncProposalProfileLocation(tx, PROFILE_ID, {});

    expect(deleteCalls).toHaveLength(1);
    expect(insertCalls).toHaveLength(0);
  });

  it('clears the link and inserts nothing when proposalData is null/undefined', async () => {
    const a = makeTx();
    await syncProposalProfileLocation(a.tx, PROFILE_ID, null);
    expect(a.deleteCalls).toHaveLength(1);
    expect(a.insertCalls).toHaveLength(0);

    const b = makeTx();
    await syncProposalProfileLocation(b.tx, PROFILE_ID, undefined);
    expect(b.deleteCalls).toHaveLength(1);
    expect(b.insertCalls).toHaveLength(0);
  });
});
