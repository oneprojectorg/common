import { createRouter } from '@tanstack/react-router';

import { routeTree } from './routeTree.gen';

/** The API serves no pages: every route is a server route. */
export function getRouter() {
  return createRouter({ routeTree });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
