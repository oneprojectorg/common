import { describe, expect, it, beforeEach, vi } from 'vitest';

describe('POST /api/auth/atproto/authorize', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return authorization URL for valid handle', async () => {
    const handle = '@testuser.bsky.social';

    const response = await fetch('/api/auth/atproto/authorize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ handle }),
    });

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('authorizationUrl');
    expect(data).toHaveProperty('state');
    expect(data.authorizationUrl).toContain('oauth/authorize');
  });

  it('should return 400 for invalid handle format', async () => {
    const handle = 'invalid-handle-format';

    const response = await fetch('/api/auth/atproto/authorize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ handle }),
    });

    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toContain('Invalid handle format');
  });

  it('should return 404 for non-existent handle', async () => {
    const handle = '@nonexistent12345.bsky.social';

    const response = await fetch('/api/auth/atproto/authorize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ handle }),
    });

    expect(response.status).toBe(404);

    const data = await response.json();
    expect(data.error).toContain('not found');
  });

  it('should enforce rate limiting', async () => {
    const handle = '@testuser.bsky.social';

    const requests = Array(6).fill(null).map(() =>
      fetch('/api/auth/atproto/authorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle }),
      })
    );

    const responses = await Promise.all(requests);

    const rateLimited = responses.some(r => r.status === 429);
    expect(rateLimited).toBe(true);
  });
});
