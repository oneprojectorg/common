export class CommonError extends Error {
  public readonly timestamp: number;

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
  public readonly suggestedStatusCode: number = 404;

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
  public readonly suggestedStatusCode: number = 400;

  constructor(message: string, fieldErrors?: Record<string, string>) {
    super(message);
    this.fieldErrors = fieldErrors;
  }
}

export class UnauthorizedError extends CommonError {
  public readonly suggestedStatusCode: number = 403;

  constructor(message?: string) {
    const defaultMessage =
      'You do not have permission to access this resource.';
    super(message ?? defaultMessage);
  }
}
