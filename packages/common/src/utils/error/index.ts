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

/** User-facing copy per caller tier; `none` (401) prompts sign-in, the rest reuse the generic 403 wording. */
const accessTierMessages: Record<AccessTier, string> = {
  none: 'You need to sign in to access this resource.',
  anon: 'You do not have permission to access this resource.',
  user: 'You do not have permission to access this resource.',
  network: 'You do not have permission to access this resource.',
};

export class AccessTierError extends CommonError {
  public readonly statusCode: number;

  constructor(public readonly callerTier: AccessTier) {
    super(accessTierMessages[callerTier]);
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

/** Content was rejected by the moderation gate. */
export class ModerationError extends CommonError {
  public readonly statusCode: number = 422;

  constructor(message?: string) {
    const defaultMessage = 'This content violates our community guidelines.';
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

/**
 * A capability this build deliberately does not provide.
 *
 * Distinct from a misconfiguration: no environment variable turns the feature
 * on, so a caller that reaches this has to change, not the deployment.
 */
export class NotImplementedError extends CommonError {
  public readonly statusCode: number = 501;

  constructor(message?: string) {
    const defaultMessage = 'This capability is not implemented.';
    super(message ?? defaultMessage);
  }
}
