import type { ParsedLocation } from '@tanstack/react-router';

/**
 * The path and query the browser shows — the vanity URL rather than the route
 * it rewrites to — for sending a visitor back after login or onboarding.
 */
export const getDestination = (location: ParsedLocation) => {
  const url = new URL(location.publicHref, 'http://localhost');

  return { pathname: url.pathname, search: url.search };
};
