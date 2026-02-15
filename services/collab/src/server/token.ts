import jwt from 'jsonwebtoken';

function getTiptapSecret(): string {
  const secret = process.env.TIPTAP_SECRET;

  if (!secret) {
    throw new Error('Missing required environment variable: TIPTAP_SECRET');
  }

  return secret;
}

/**
 * Generate a Tiptap Cloud collaboration JWT for a user.
 *
 * The token restricts the user to only the specified document names.
 *
 * @see https://tiptap.dev/docs/collaboration/getting-started/authenticate
 *
 * @param userId - The authenticated user's identifier
 * @param allowedDocumentNames - Document names the user may access (supports trailing wildcards)
 * @returns Signed JWT string
 */
export function generateCollabToken(
  userId: string,
  allowedDocumentNames: string[],
): string {
  const secret = getTiptapSecret();

  return jwt.sign(
    {
      sub: userId,
      allowedDocumentNames,
    },
    secret,
    {
      algorithm: 'HS256',
      expiresIn: 60 * 60 * 24, // 24 hours
    },
  );
}
