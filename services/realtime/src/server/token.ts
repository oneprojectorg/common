import jwt from 'jsonwebtoken';

function getTokenSecret(): string {
  const secret = process.env.CENTRIFUGO_TOKEN_SECRET;

  console.log('===== Using Centrifugo token secret:', secret);
  if (!secret) {
    throw new Error(
      'Missing required environment variable: CENTRIFUGO_TOKEN_SECRET',
    );
  }

  return secret;
}

/**
 * Generate a Centrifugo connection token for a user
 *
 * https://centrifugal.dev/docs/server/authentication#connection-jwt-claims
 *
 * @param userId - The user ID to include in the token (use empty string for anonymous)
 * @returns JWT token string
 */
export function generateConnectionToken(userId: string): string {
  const secret = getTokenSecret();
  console.log('===== Using Centrifugo token secret:', secret);

  // Token expires in 24 hours
  const expiresIn = 60 * 60 * 24;

  const token = jwt.sign(
    {
      sub: userId,
    },
    secret,
    {
      algorithm: 'HS256',
      expiresIn,
    },
  );

  return token;
}
