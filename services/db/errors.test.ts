import { describe, expect, it } from 'vitest';

import { isTransientConnectionError } from './errors';

/** A driver error as postgres-js raises it: the code lives on `.code`. */
const driverError = (code: string) =>
  Object.assign(new Error(`write ${code} pooler.example.invalid:6543`), {
    code,
  });

/** How tRPC hands a resolver failure to a middleware: wrapped, code on `cause`. */
const wrapped = (cause: unknown, depth = 1): Error => {
  let error = new Error('INTERNAL_SERVER_ERROR', { cause });
  for (let i = 1; i < depth; i++) {
    error = new Error('INTERNAL_SERVER_ERROR', { cause: error });
  }
  return error;
};

const DROPPED_SOCKET_CODES = [
  'CONNECTION_CLOSED',
  'CONNECTION_DESTROYED',
  'CONNECTION_ENDED',
  'ECONNRESET',
  'EPIPE',
  'ETIMEDOUT',
  '57P01',
  '08006',
  '08003',
];

describe('isTransientConnectionError — dropped sockets', () => {
  it.each(DROPPED_SOCKET_CODES)('matches %s on the error itself', (code) => {
    expect(isTransientConnectionError(driverError(code))).toBe(true);
  });

  it.each(DROPPED_SOCKET_CODES)(
    'matches %s through a wrapping error, which is how tRPC delivers it',
    (code) => {
      expect(isTransientConnectionError(wrapped(driverError(code)))).toBe(true);
    },
  );

  it('matches the SQLSTATE a pooler restart delivers to in-flight sessions', () => {
    // 57P01 is how Supavisor/Postgres actually announce a restart; without it
    // the most common form of this outage is never replayed.
    expect(isTransientConnectionError(driverError('57P01'))).toBe(true);
  });

  it('does not replay a connect that already spent its whole timeout', () => {
    // Replaying CONNECT_TIMEOUT doubles the user's wait instead of saving it.
    expect(isTransientConnectionError(driverError('CONNECT_TIMEOUT'))).toBe(
      false,
    );
  });

  it('walks a chain several levels deep', () => {
    expect(
      isTransientConnectionError(wrapped(driverError('CONNECTION_CLOSED'), 5)),
    ).toBe(true);
  });
});

describe('isTransientConnectionError — must not replay', () => {
  // Replaying these would re-run a query the server already rejected on its
  // merits. A unique violation is deterministic; a serialization failure needs
  // the caller's own retry semantics, not a silent one 200ms later.
  it.each([
    ['23505', 'unique violation'],
    ['40001', 'serialization failure'],
    ['57014', 'statement timeout'],
    ['42601', 'syntax error'],
  ])('leaves SQLSTATE %s (%s) alone', (code) => {
    expect(isTransientConnectionError(driverError(code))).toBe(false);
    expect(isTransientConnectionError(wrapped(driverError(code)))).toBe(false);
  });

  it('ignores an error with no code at all', () => {
    expect(isTransientConnectionError(new Error('Proposal not found'))).toBe(
      false,
    );
  });

  it('ignores a non-string code rather than coercing it', () => {
    expect(
      isTransientConnectionError(
        Object.assign(new Error('boom'), { code: 500 }),
      ),
    ).toBe(false);
  });

  it.each([
    ['a string', 'CONNECTION_CLOSED'],
    ['null', null],
    ['undefined', undefined],
    ['a plain object carrying a transient code', { code: 'ECONNRESET' }],
  ])('ignores %s, which is not an Error', (_label, value) => {
    expect(isTransientConnectionError(value)).toBe(false);
  });
});

describe('isTransientConnectionError — chain walk terminates', () => {
  it('gives up past the depth cap instead of walking forever', () => {
    // 11 wrappers puts the transient cause one level beyond MAX_CAUSE_DEPTH.
    expect(
      isTransientConnectionError(wrapped(driverError('CONNECTION_CLOSED'), 11)),
    ).toBe(false);
  });

  it('returns on a self-referential cause chain instead of hanging', () => {
    const first = new Error('first');
    const second = new Error('second', { cause: first });
    // A cycle: the depth cap is the only thing that ends this walk.
    (first as { cause?: unknown }).cause = second;

    expect(isTransientConnectionError(second)).toBe(false);
  });
});
