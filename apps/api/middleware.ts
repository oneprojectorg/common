import { OPURLConfig, urlMatcher } from '@op/core';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const corsOptions = {
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  //   'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': 'true',
};

const { IS_DEVELOPMENT } = OPURLConfig('API');

export function middleware(request: NextRequest) {
  // Check the origin from the request
  const origin = request.headers.get('origin') ?? '';
  const isAllowedOrigin = IS_DEVELOPMENT
    ? true
    : origin.match(urlMatcher)?.length;

  // Handle preflighted requests
  const isPreflight = request.method === 'OPTIONS';

  if (isPreflight) {
    const preflightHeaders = {
      ...(isAllowedOrigin && { 'Access-Control-Allow-Origin': origin }),
      ...corsOptions,
      'Access-Control-Allow-Headers':
        request.headers.get('access-control-request-headers') || '',
    };

    return NextResponse.json({}, { headers: preflightHeaders });
  }

  // Handle simple requests
  const response = NextResponse.next();

  if (isAllowedOrigin) {
    response.headers.set('Access-Control-Allow-Origin', origin);
  }

  Object.entries(corsOptions).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  response.headers.set(
    'Access-Control-Allow-Headers',
    request.headers.get('access-control-request-headers') || '',
  );

  return response;
}

export const config = {
  matcher: '/api/:path*',
};
