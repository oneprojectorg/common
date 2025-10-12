import { describe, expect, it, beforeEach, vi } from 'vitest';

describe('GET /api/auth/atproto/callback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should complete authentication with valid code and state', async () => {
    const params = new URLSearchParams({
      code: 'valid-auth-code',
      state: 'valid-state',
    });

    const response = await fetch(`/api/auth/atproto/callback?${params}`);

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBeTruthy();
    expect(response.headers.get('set-cookie')).toContain('session');
  });

  it('should reject invalid state parameter', async () => {
    const params = new URLSearchParams({
      code: 'valid-auth-code',
      state: 'invalid-state',
    });

    const response = await fetch(`/api/auth/atproto/callback?${params}`);

    expect(response.status).toBe(302);
    const location = response.headers.get('location');
    expect(location).toContain('error');
    expect(location).toContain('invalid');
  });

  it('should link accounts when email matches existing user', async () => {
    const params = new URLSearchParams({
      code: 'auth-code-with-existing-email',
      state: 'valid-state',
    });

    const response = await fetch(`/api/auth/atproto/callback?${params}`);

    expect(response.status).toBe(302);
  });

  it('should redirect to email collection when email missing', async () => {
    const params = new URLSearchParams({
      code: 'auth-code-without-email',
      state: 'valid-state',
    });

    const response = await fetch(`/api/auth/atproto/callback?${params}`);

    expect(response.status).toBe(302);
    const location = response.headers.get('location');
    expect(location).toContain('requireEmail=true');
    expect(location).toContain('partialSessionId');
  });

  it('should reject user not on allow list', async () => {
    const params = new URLSearchParams({
      code: 'auth-code-not-allowed',
      state: 'valid-state',
    });

    const response = await fetch(`/api/auth/atproto/callback?${params}`);

    expect(response.status).toBe(302);
    const location = response.headers.get('location');
    expect(location).toContain('error');
    expect(location).toContain('invite-only');
  });
});
