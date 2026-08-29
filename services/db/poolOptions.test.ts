import { describe, expect, it } from 'vitest';

import { buildPoolOptions } from './poolOptions';

describe('buildPoolOptions — request path', () => {
  it('recycles idle sockets before the transaction pooler reaps them', () => {
    // The whole point of the fix: postgres-js defaults this to null, which
    // leaves a dead socket in the pool for the next request to write into.
    expect(buildPoolOptions({}).idle_timeout).toBe(20);
  });

  it('fails a stalled connect inside a page render budget', () => {
    expect(buildPoolOptions({}).connect_timeout).toBe(10);
  });

  it('resolves a concrete pool size rather than leaving max undefined', () => {
    // postgres-js reads `max: undefined` as a one-socket pool, which hangs
    // against transaction-mode pooling (#1399).
    expect(buildPoolOptions({}).max).toBe(10);
  });

  it('caps statements and idle transactions', () => {
    expect(buildPoolOptions({}).connection).toEqual({
      statement_timeout: 30_000,
      idle_in_transaction_session_timeout: 60_000,
    });
  });

  it('takes overrides from the environment', () => {
    expect(
      buildPoolOptions({
        DB_POOL_MAX: '4',
        DB_IDLE_TIMEOUT_S: '5',
        DB_CONNECT_TIMEOUT_S: '3',
        DB_STATEMENT_TIMEOUT_MS: '1000',
        DB_IDLE_IN_TXN_TIMEOUT_MS: '2000',
      }),
    ).toEqual({
      max: 4,
      idle_timeout: 5,
      connect_timeout: 3,
      connection: {
        statement_timeout: 1000,
        idle_in_transaction_session_timeout: 2000,
      },
    });
  });
});

describe('buildPoolOptions — maintenance', () => {
  it.each(['DB_MIGRATING', 'DB_SEEDING'])(
    'keeps the long connect window under %s, for a cold database',
    (flag) => {
      const options = buildPoolOptions({ [flag]: 'true' });

      expect(options.connect_timeout).toBe(30);
      expect(options.max).toBe(1);
      // Long DDL and seed inserts must not be killed by a request-side cap.
      expect(options.connection).toEqual({});
    },
  );

  it('still recycles idle sockets during maintenance', () => {
    expect(buildPoolOptions({ DB_MIGRATING: 'true' }).idle_timeout).toBe(20);
  });

  it('lets an operator override the maintenance connect window', () => {
    expect(
      buildPoolOptions({ DB_MIGRATING: 'true', DB_CONNECT_TIMEOUT_S: '90' })
        .connect_timeout,
    ).toBe(90);
  });
});

describe('buildPoolOptions — unusable values fall back', () => {
  // A pool sized 0, or a 0s connect budget, is worse than the default: it would
  // take the whole API down rather than degrade. Falling back is deliberate.
  it.each(['0', '-5', 'abc', ''])(
    'ignores %o and keeps the defaults',
    (raw) => {
      expect(
        buildPoolOptions({
          DB_POOL_MAX: raw,
          DB_IDLE_TIMEOUT_S: raw,
          DB_CONNECT_TIMEOUT_S: raw,
        }),
      ).toMatchObject({ max: 10, idle_timeout: 20, connect_timeout: 10 });
    },
  );

  it('reads a trailing-unit value as its leading number', () => {
    expect(buildPoolOptions({ DB_IDLE_TIMEOUT_S: '20s' }).idle_timeout).toBe(
      20,
    );
  });
});
