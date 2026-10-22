import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';

import { transformMiddlewareRequest } from './middleware';

describe('transformMiddlewareRequest', () => {
  it('describes the request without the caller IP', () => {
    const request = new NextRequest('https://common.org/en/columbus?tab=all', {
      headers: {
        'x-forwarded-for': '203.0.113.42',
        'x-real-ip': '203.0.113.42',
        'user-agent': 'Mozilla/5.0',
      },
    });

    const [message, data] = transformMiddlewareRequest(request);

    expect(message).toBe('GET /en/columbus');
    expect(data).toEqual({
      method: 'GET',
      url: 'https://common.org/en/columbus?tab=all',
      pathname: '/en/columbus',
      search: '?tab=all',
      host: 'common.org',
      userAgent: 'Mozilla/5.0',
      referer: undefined,
    });
  });
});
