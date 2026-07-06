import { CommonError } from '@op/common';
import { forbidden, notFound } from 'next/navigation';

/**
 * Translate a server-side fetch error into the correct Next.js navigation
 * interrupt so unresolved resources render an accurate status page instead of
 * a generic 500.
 *
 * tRPC's server caller re-throws procedure errors with the original
 * `CommonError` attached as `error.cause`, so we inspect that:
 *   - 404 → notFound()
 *   - 401/403 → forbidden()
 *   - anything else → rethrow (a genuine 500)
 *
 * Call it from a server component / loader catch block:
 *   try {
 *     return await fetchThing(id);
 *   } catch (error) {
 *     handleServerError(error);
 *   }
 *
 * The return type is `never`: it always either triggers a navigation interrupt
 * or rethrows.
 */
export function handleServerError(error: unknown): never {
  const cause = error instanceof Error ? error.cause : null;

  if (cause instanceof CommonError) {
    if (cause.statusCode === 404) {
      notFound();
    }
    if (cause.statusCode === 401 || cause.statusCode === 403) {
      forbidden();
    }
  }

  throw error;
}
