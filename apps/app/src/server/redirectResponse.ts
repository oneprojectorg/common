/**
 * A 307 to `url`. Built by hand rather than with `Response.redirect()`, whose
 * headers are immutable: cookies set during the request (a new Supabase
 * session) are appended to it on the way out.
 */
export const redirectResponse = (url: string | URL) =>
  new Response(null, {
    status: 307,
    headers: { location: url.toString() },
  });
