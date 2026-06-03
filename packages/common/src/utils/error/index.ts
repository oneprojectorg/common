export class CommonError extends Error {
  public readonly timestamp: number;
  public readonly statusCode: number = 500;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name; // Ensures correct error name
    this.timestamp = Date.now();
    // Maintains proper stack trace (important for V8 environments like Node.js)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export class NotFoundError extends CommonError {
  public readonly resourceType: string;
  public readonly resourceId?: string | number;
  public readonly statusCode: number = 404;

  constructor(
    resourceType: string,
    resourceId?: string | number,
    message?: string,
  ) {
    const defaultMessage = resourceId
      ? `${resourceType} with ID '${resourceId}' not found.`
      : `${resourceType} not found.`;
    super(message ?? defaultMessage);
    this.resourceType = resourceType;
    this.resourceId = resourceId;
  }
}

/** Error for invalid input data. */
export class ValidationError extends CommonError {
  public readonly fieldErrors?: Record<string, string>; // Optional: specific field issues
  public readonly statusCode: number = 400;

  constructor(message: string, fieldErrors?: Record<string, string>) {
    super(message);
    this.fieldErrors = fieldErrors;
  }
}

export class UnauthorizedError extends CommonError {
  public readonly statusCode: number = 403;

  constructor(message?: string) {
    const defaultMessage =
      'You do not have permission to access this resource.';
    super(message ?? defaultMessage);
  }
}

/**
 * The caller's position on the access ladder. Procedures declare a minimum
 * required tier; the gate compares it against the caller's actual tier.
 *
 *   none    — no session at all
 *   anon    — an anonymous (or unconfirmed) session, no real identity
 *   user    — a confirmed, real account
 *   network — a confirmed account that is in the instance's network
 */
export type AccessTier = 'none' | 'anon' | 'user' | 'network';

/**
 * Raised by the API tier gate (`verifyAuthentication` and the
 * `withAuthenticated*` middlewares) when the caller's access tier is below what
 * a procedure requires, before any resolver-level authorization runs.
 *
 * The status code follows from `callerTier`: a caller with no session at all
 * (`none`) gets **401** — they must authenticate; a caller who *is*
 * authenticated but whose tier is insufficient (`anon` needing to sign up, a
 * `user` needing network access) gets **403** — re-authenticating won't help.
 *
 * This is distinct from {@link UnauthorizedError}, which is resolver-level
 * resource authorization: the caller's tier is sufficient, but they lack
 * permission on a specific object. Keeping the two separate lets the gating
 * tests prove the gate rejected a caller at the right tier.
 */
export class AccessTierError extends CommonError {
  public readonly statusCode: number;

  constructor(public readonly callerTier: AccessTier) {
    super(`Caller tier '${callerTier}' is below the required access tier.`);
    this.statusCode = callerTier === 'none' ? 401 : 403;
  }
}

export class ConflictError extends CommonError {
  public readonly statusCode: number = 409;

  constructor(message?: string) {
    const defaultMessage = 'A conflict occurred with the current state.';
    super(message ?? defaultMessage);
  }
}

export class RateLimitError extends CommonError {
  public readonly statusCode: number = 429;

  constructor(message?: string) {
    const defaultMessage = 'Too many requests. Please try again later.';
    super(message ?? defaultMessage);
  }
}
