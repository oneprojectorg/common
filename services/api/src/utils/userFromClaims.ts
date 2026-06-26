import type { JwtPayload, User } from '@op/supabase/lib';

/** Project the verified JWT payload onto the {@link User} shape. */
export const userFromClaims = (claims: JwtPayload): User => {
  // Optional claims are typed `any` on JwtPayload — guard the shape against a
  // signature-valid-but-malformed token.
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
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
