import { markRequestForbidden } from '@/server/requestState';
import { createSerializationAdapter } from '@tanstack/react-router';
import { createIsomorphicFn } from '@tanstack/react-start';

/**
 * Thrown when the visitor is signed in but has no access. Signing in again
 * would not help, so it renders the no-access screen rather than redirecting
 * to login.
 */
export class ForbiddenError extends Error {
  constructor() {
    super('Forbidden');
    this.name = 'ForbiddenError';
  }
}

export const isForbiddenError = (error: unknown): error is ForbiddenError =>
  error instanceof ForbiddenError;

/** Carries a ForbiddenError across the server/client boundary intact. */
export const forbiddenErrorAdapter = createSerializationAdapter({
  key: 'forbidden-error',
  test: isForbiddenError,
  toSerializable: () => true,
  fromSerializable: () => new ForbiddenError(),
});

const markForbidden = createIsomorphicFn()
  .server(() => markRequestForbidden())
  .client(() => {});

/** Stops the render and shows the no-access screen, with a 403 on the server. */
export function forbidden(): never {
  markForbidden();

  throw new ForbiddenError();
}
