import { describe, expect, it, beforeEach, vi } from 'vitest';

describe('POST /api/auth/atproto/complete-email', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should complete signup with valid email and partial session', async () => {
    const response = await fetch('/api/auth/atproto/complete-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        partialSessionId: 'valid-session-id',
        email: 'allowed@example.com',
      }),
    });

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('success', true);
    expect(data).toHaveProperty('redirectUrl');
  });

  it('should return 400 for invalid email format', async () => {
    const response = await fetch('/api/auth/atproto/complete-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        partialSessionId: 'valid-session-id',
        email: 'invalid-email',
      }),
    });

    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toContain('Invalid email');
  });

  it('should return 403 for email not on allow list', async () => {
    const response = await fetch('/api/auth/atproto/complete-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        partialSessionId: 'valid-session-id',
        email: 'notallowed@blocked.com',
      }),
    });

    expect(response.status).toBe(403);

    const data = await response.json();
    expect(data.error).toContain('invite-only');
  });

  it('should return 404 for expired or invalid session', async () => {
    const response = await fetch('/api/auth/atproto/complete-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        partialSessionId: 'invalid-session-id',
        email: 'allowed@example.com',
      }),
    });

    expect(response.status).toBe(404);

    const data = await response.json();
    expect(data.error).toContain('Session not found');
  });
});
