import type { CommonUser } from '@op/api/encoders';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The `@op/common` barrel boots the Drizzle client, `server-only` and the
// PostHog SDK on import — none of which a route test can or should stand up.
// `loadDecision` reads only `CommonError` and branches only on its statusCode,
// so a stand-in that `instanceof` resolves to drives the branch faithfully.
const { CommonError } = vi.hoisted(() => ({
  CommonError: class CommonError extends Error {
    statusCode: number;

    constructor(message: string, statusCode: number) {
      super(message);
      this.statusCode = statusCode;
    }
  },
}));

vi.mock('@op/common', () => ({ CommonError }));

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
// case independent. Spread the real module so an unrelated React import
// appearing in this graph later doesn't fail as a missing export.
vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  cache: <T>(fn: T) => fn,
}));

const { loadDecision } = await import('./loadDecision');

const asUser = (overrides: Partial<CommonUser> = {}) =>
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
  getMyAccount.mockResolvedValue(asUser());
});

describe('loadDecision — a refused viewer', () => {
  it('sends a signed-out visitor to login with a way back to the decision', async () => {
    getMyAccount.mockResolvedValue(null);
    getDecisionBySlug.mockRejectedValue(
      refusalFromApi(new CommonError('User does not have access', 403)),
    );

    await expect(loadDecision('participatory-budget')).rejects.toThrow(
      'NEXT_REDIRECT:/login?redirect=%2Fen%2Fdecisions%2Fparticipatory-budget',
    );
  });

  // Anonymous visitors on these routes may already own a submitted proposal, so
  // they get the link flow rather than a fresh account.
  it('sends an anonymous session to the account-link flow', async () => {
    getMyAccount.mockResolvedValue(asUser({ isAnonymous: true }));
    getDecisionBySlug.mockRejectedValue(
      refusalFromApi(new CommonError('User does not have access', 403)),
    );

    await expect(loadDecision('participatory-budget')).rejects.toThrow(
      'NEXT_REDIRECT:/login?link=1&redirect=%2Fen%2Fdecisions%2Fparticipatory-budget',
    );
  });

  it('shows a real account the no-access screen — re-authenticating cannot help', async () => {
    getMyAccount.mockResolvedValue(asUser({ id: 'real-user' }));
    getDecisionBySlug.mockRejectedValue(
      refusalFromApi(new CommonError('User does not have access', 403)),
    );

    await expect(loadDecision('participatory-budget')).rejects.toThrow(
      'NEXT_FORBIDDEN',
    );
  });
});

describe('loadDecision — other outcomes are unchanged', () => {
  it('returns a readable decision without consulting the session', async () => {
    getMyAccount.mockResolvedValue(null);
    getDecisionBySlug.mockResolvedValue(aReadableDecision);

    await expect(loadDecision('participatory-budget')).resolves.toEqual({
      decisionProfile: aReadableDecision,
      instanceId: 'instance-1',
      ownerSlug: 'one-project',
    });
    // The login redirect is reserved for refusals — a public decision must not
    // cost an anonymous reader their page.
    expect(getMyAccount).not.toHaveBeenCalled();
  });

  it('404s a 404 rather than bouncing through login', async () => {
    getMyAccount.mockResolvedValue(null);
    getDecisionBySlug.mockRejectedValue(
      refusalFromApi(new CommonError('Decision not found', 404)),
    );

    await expect(loadDecision('participatory-budget')).rejects.toThrow(
      'NEXT_NOT_FOUND',
    );
  });

  it.each([
    ['the profile carries no process instance', { processInstance: undefined }],
    [
      'the owning profile has no slug',
      { processInstance: { id: 'instance-1', owner: {} } },
    ],
  ])('404s when %s', async (_label, overrides) => {
    getMyAccount.mockResolvedValue(null);
    getDecisionBySlug.mockResolvedValue({ ...aReadableDecision, ...overrides });

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
