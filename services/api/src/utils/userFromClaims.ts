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
  // `iat`, `sub`, `role`, `aud` are typed as required on JwtPayload, so no
  // runtime guards. `email`/`phone`/`*_metadata`/`is_anonymous` are typed as
  // `[key: string]: any` extras, so they DO need shape validation against a
  // signature-valid-but-malformed JWT.
  const aud = Array.isArray(claims.aud) ? (claims.aud[0] ?? '') : claims.aud;

  return {
    id: claims.sub,
    aud,
    role: claims.role,
    email: typeof claims.email === 'string' ? claims.email : undefined,
    phone: typeof claims.phone === 'string' ? claims.phone : undefined,
    app_metadata: isRecord(claims.app_metadata) ? claims.app_metadata : {},
    user_metadata: isRecord(claims.user_metadata) ? claims.user_metadata : {},
    is_anonymous:
      typeof claims.is_anonymous === 'boolean'
        ? claims.is_anonymous
        : undefined,
    created_at: new Date(claims.iat * 1000).toISOString(),
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
