/**
 * Replacement for `next/headers` in the integration project. Outside a
 * Next.js request scope `cookies()` and `headers()` throw, so
 * `vitest.config.ts` aliases `next/headers` to this module for every file,
 * including the workspace packages' own copies of `next`, which a `vi.mock`
 * in one test file would not reach.
 *
 * `mockServerRequest` sets the request the next server component call sees;
 * `serverRequest.ts` builds one from a real Supabase session.
 */

export type RequestCookie = { name: string; value: string };

let requestCookies: RequestCookie[] = [];
let requestHeaders = new Headers();

/** Sets the cookies and headers the server component under test runs with. */
export const mockServerRequest = ({
  cookies = [],
  headers = {},
}: {
  cookies?: RequestCookie[];
  headers?: Record<string, string>;
} = {}) => {
  requestCookies = cookies;
  requestHeaders = new Headers(headers);
};

export const cookies = async () => ({
  getAll: () => requestCookies,
  get: (name: string) => requestCookies.find((cookie) => cookie.name === name),
  has: (name: string) => requestCookies.some((cookie) => cookie.name === name),
  set: () => {
    throw new Error('A server component cannot set cookies');
  },
});

export const headers = async () => requestHeaders;
