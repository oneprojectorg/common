/**
 * The `ANY` handler for a server route: an `OPTIONS` request learns which
 * methods the route allows, and any other method it doesn't handle gets a
 * 405 rather than falling through to the page renderer.
 */
export const methodNotAllowed =
  (handled: Array<string>) =>
  ({ request }: { request: Request }) => {
    const allow = [
      ...handled,
      ...(handled.includes('GET') && !handled.includes('HEAD') ? ['HEAD'] : []),
      ...(handled.includes('OPTIONS') ? [] : ['OPTIONS']),
    ].join(', ');

    return new Response(null, {
      status: request.method === 'OPTIONS' ? 204 : 405,
      headers: { Allow: allow },
    });
  };
