import type { JwtPayload, User } from '@op/supabase/lib';

/**
 * Project the verified JWT payload onto the `User` shape that downstream code
 * (services, encoders, analytics) already consumes. Only the fields actually
 * present in the JWT — id (sub), email, phone, app_metadata, user_metadata,
 * is_anonymous, role, aud — are populated. Server-side timestamps such as
 * `confirmed_at`, `email_confirmed_at`, and `last_sign_in_at` are intentionally
 * absent: a caller that needs them MUST go through `getCachedAuthUser`
 * (authoritative) instead of `getCachedAuthClaims` (local-verify).
 *
 * `created_at` is required by `User` but is not in the JWT. We derive it from
 * the JWT `iat` (issued-at) timestamp so the shape is satisfied without
 * fabricating a misleading "account created at" value — the field is read by
 * no consumer along claims-based code paths today.
 */
export const userFromClaims = (claims: JwtPayload): User => {
  const issuedAt =
    typeof claims.iat === 'number'
      ? new Date(claims.iat * 1000).toISOString()
      : '';
  const aud = Array.isArray(claims.aud) ? (claims.aud[0] ?? '') : claims.aud;
  const appMetadata = isRecord(claims.app_metadata) ? claims.app_metadata : {};
  const userMetadata = isRecord(claims.user_metadata)
    ? claims.user_metadata
    : {};

  return {
    id: claims.sub,
    aud,
    role: typeof claims.role === 'string' ? claims.role : undefined,
    email: typeof claims.email === 'string' ? claims.email : undefined,
    phone: typeof claims.phone === 'string' ? claims.phone : undefined,
    app_metadata: appMetadata,
    user_metadata: userMetadata,
    is_anonymous:
      typeof claims.is_anonymous === 'boolean'
        ? claims.is_anonymous
        : undefined,
    created_at: issuedAt,
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
