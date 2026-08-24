import type { CommonUser } from '@op/api/encoders';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `decision.getDecisionBySlug` conflates "no such slug" and "no access" into one
 * 403 so it can't leak which decisions exist. That makes this catch block the
 * only place that can decide what a refused viewer sees — and the decision turns
 * on whether signing in could possibly help.
 */

// The `@op/common` barrel boots the Drizzle client, `server-only` and the
// PostHog SDK on import — none of which a route test can or should stand up.
// Substitute the error classes this catch block branches on. `instanceof
// CommonError` inside loadDecision resolves to the class below, so the branch
// is driven by `statusCode` exactly as it is in production.
const { CommonError, UnauthorizedError, NotFoundError } = vi.hoisted(() => {
  class CommonError extends Error {
    statusCode: number;

    constructor(message: string, statusCode: number) {
      super(message);
      this.statusCode = statusCode;
    }
  }

  return {
    CommonError,
    UnauthorizedError: class UnauthorizedError extends CommonError {
      constructor(message: string) {
        super(message, 403);
      }
    },
    NotFoundError: class NotFoundError extends CommonError {
      constructor(message: string) {
        super(message, 404);
      }
    },
  };
});

vi.mock('@op/common', () => ({
  CommonError,
  UnauthorizedError,
  NotFoundError,
}));

const getDecisionBySlug = vi.fn();
const getMyAccount = vi.fn<() => Promise<CommonUser | null>>();

// Stubbing the transport rather than `getUser` keeps the real session lookup —
// including the `cache()` wrapper — inside the code under test.
vi.mock('@op/api/serverClient', () => ({
  createClient: async () => ({
    decision: { getDecisionBySlug },
    account: { getMyAccount },
  }),
}));

vi.mock('next/headers', () => ({
  headers: async () => ({
    get: () => '/en/decisions/participatory-budget',
  }),
}));

vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
  forbidden: () => {
    throw new Error('NEXT_FORBIDDEN');
  },
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));

// React's `cache` memoizes per request; the identity wrapper keeps each test
// case independent.
vi.mock('react', () => ({ cache: <T>(fn: T) => fn }));

const { loadDecision } = await import('./loadDecision');

const asUser = (overrides: Partial<CommonUser>) =>
  ({
    id: 'user-1',
    isAnonymous: false,
    isNetworkMember: true,
    ...overrides,
  }) as CommonUser;

// The tRPC client surfaces a service-layer throw with the original error on
// `cause` — that's what the catch block reads the status off.
const refusalFromApi = (cause: unknown) =>
  Object.assign(new Error('Request failed'), { cause });

const aReadableDecision = {
  id: 'profile-1',
  name: 'Participatory Budget',
  processInstance: { id: 'instance-1', owner: { slug: 'one-project' } },
};

beforeEach(() => {
  getDecisionBySlug.mockReset();
  getMyAccount.mockReset();
  getMyAccount.mockResolvedValue(asUser({}));
});

describe('loadDecision — a refused viewer', () => {
  it.each([
    ['a signed-out visitor', null],
    ['an anonymous session', asUser({ isAnonymous: true })],
  ])('sends %s to login with a way back to the decision', async (_l, user) => {
    getMyAccount.mockResolvedValue(user);
    getDecisionBySlug.mockRejectedValue(
      refusalFromApi(new UnauthorizedError('User does not have access')),
    );

    await expect(loadDecision('participatory-budget')).rejects.toThrow(
      'NEXT_REDIRECT:/login?redirect=%2Fen%2Fdecisions%2Fparticipatory-budget',
    );
  });

  it('shows a real account the no-access screen — re-authenticating cannot help', async () => {
    getMyAccount.mockResolvedValue(asUser({ id: 'real-user' }));
    getDecisionBySlug.mockRejectedValue(
      refusalFromApi(new UnauthorizedError('User does not have access')),
    );

    await expect(loadDecision('participatory-budget')).rejects.toThrow(
      'NEXT_FORBIDDEN',
    );
  });
});

describe('loadDecision — other outcomes are unchanged', () => {
  it('returns the decision when the viewer can read it', async () => {
    getDecisionBySlug.mockResolvedValue(aReadableDecision);

    await expect(loadDecision('participatory-budget')).resolves.toEqual({
      decisionProfile: aReadableDecision,
      instanceId: 'instance-1',
      ownerSlug: 'one-project',
    });
  });

  it('reads a public decision without needing a session', async () => {
    getMyAccount.mockResolvedValue(null);
    getDecisionBySlug.mockResolvedValue(aReadableDecision);

    await expect(loadDecision('participatory-budget')).resolves.toMatchObject({
      instanceId: 'instance-1',
    });
    // The login redirect is reserved for refusals — a public decision must not
    // cost an anonymous reader their page.
    expect(getMyAccount).not.toHaveBeenCalled();
  });

  it('404s a 404 rather than bouncing through login', async () => {
    getMyAccount.mockResolvedValue(null);
    getDecisionBySlug.mockRejectedValue(
      refusalFromApi(new NotFoundError('Decision not found')),
    );

    await expect(loadDecision('participatory-budget')).rejects.toThrow(
      'NEXT_NOT_FOUND',
    );
  });

  it('re-throws an unexpected failure instead of masking it as no-access', async () => {
    getDecisionBySlug.mockRejectedValue(new Error('connection reset'));

    await expect(loadDecision('participatory-budget')).rejects.toThrow(
      'connection reset',
    );
  });
});
