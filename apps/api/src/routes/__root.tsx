import { createRootRoute } from '@tanstack/react-router';

/**
 * Start requires a root route, but nothing renders under it: `/` redirects to
 * the app, the `/api` routes answer with their handlers, and `$.ts` answers
 * every other path with a 404.
 */
export const Route = createRootRoute({});
