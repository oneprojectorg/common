import jwt from 'jsonwebtoken';
import { describe, expect, it, vi } from 'vitest';

import { TestOrganizationDataManager } from '../../test/helpers/TestOrganizationDataManager';
import {
  createIsolatedSession,
  createTestContextWithSession,
} from '../../test/supabase-utils';
import { createCallerFactory } from '../../trpcFactory';
import { realtimeRouter } from './index';

const createCaller = createCallerFactory(realtimeRouter);

describe.concurrent('realtime.getToken', () => {
  it('should reject requests from unauthenticated users', async () => {
    const caller = createCaller(await createTestContextWithSession(null));

    await expect(() => caller.getToken()).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });

  it('should throw error when CENTRIFUGO_TOKEN_SECRET is not set', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);

    const { adminUser } = await testData.createOrganization({
      users: { admin: 1 },
    });

    const { session } = await createIsolatedSession(adminUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    // Store the original value
    const originalSecret = process.env.CENTRIFUGO_TOKEN_SECRET;

    // Temporarily unset the environment variable
    vi.stubEnv('CENTRIFUGO_TOKEN_SECRET', undefined);

    try {
      await expect(() => caller.getToken()).rejects.toThrow();
    } finally {
      // Restore the original value
      if (originalSecret) {
        vi.stubEnv('CENTRIFUGO_TOKEN_SECRET', originalSecret);
      } else {
        vi.unstubAllEnvs();
      }
    }
  });

  it('should generate a valid JWT token with correct claims', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);

    const { adminUser } = await testData.createOrganization({
      users: { admin: 1 },
    });

    const { session } = await createIsolatedSession(adminUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    const result = await caller.getToken();

    expect(result).toMatchObject({
      token: expect.any(String),
    });

    const decoded = jwt.decode(result.token, { complete: true });

    expect(decoded).toBeTruthy();
    expect(decoded?.header.alg).toBe('HS256');
    expect(decoded?.payload).toMatchObject({
      sub: adminUser.authUserId,
      exp: expect.any(Number),
    });

    if (typeof decoded?.payload !== 'string') {
      expect(decoded?.payload.exp).toBeGreaterThan(
        Math.floor(Date.now() / 1000),
      );
    }
  });

  it('should generate a token that can be verified with the secret', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);

    const { adminUser } = await testData.createOrganization({
      users: { admin: 1 },
    });

    const { session } = await createIsolatedSession(adminUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    const result = await caller.getToken();

    const secret = process.env.CENTRIFUGO_TOKEN_SECRET;
    if (!secret) {
      throw new Error('Missing CENTRIFUGO_TOKEN_SECRET');
    }

    const verified = jwt.verify(result.token, secret) as jwt.JwtPayload;

    expect(verified.sub).toBe(adminUser.authUserId);
    expect(verified.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });
});
