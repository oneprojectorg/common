import { describe, expect, it } from 'vitest';

describe('GET /api/atproto/client-metadata.json', () => {
  it('should return valid client metadata', async () => {
    const response = await fetch('/api/atproto/client-metadata.json');

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');

    const metadata = await response.json();

    expect(metadata).toHaveProperty('client_id');
    expect(metadata).toHaveProperty('client_name');
    expect(metadata).toHaveProperty('grant_types');
    expect(metadata).toHaveProperty('redirect_uris');
    expect(metadata).toHaveProperty('scope', 'atproto');
    expect(metadata).toHaveProperty('dpop_bound_access_tokens', true);

    expect(metadata.client_id).toContain('/client-metadata.json');
    expect(metadata.redirect_uris).toContain('/callback');
  });

  it('should include proper caching headers', async () => {
    const response = await fetch('/api/atproto/client-metadata.json');

    expect(response.headers.get('cache-control')).toBeTruthy();
  });

  it('should use correct URLs for current environment', async () => {
    const response = await fetch('/api/atproto/client-metadata.json');
    const metadata = await response.json();

    const baseUrl = metadata.client_id.replace('/api/atproto/client-metadata.json', '');

    expect(metadata.redirect_uris[0]).toContain(baseUrl);
  });
});
