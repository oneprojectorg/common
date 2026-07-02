import type { NextRequest } from 'next/server';

import { proxyIframelyCdn } from '../proxyIframelyCdn';

export async function GET(request: NextRequest) {
  return proxyIframelyCdn({
    path: '/embed.js',
    search: request.nextUrl.search,
    responseHeaders: {
      'Content-Type': 'text/javascript; charset=utf-8',
    },
  });
}
