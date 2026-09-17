import jwt from 'jsonwebtoken';

/** Tiptap asks for 30 minutes or less. */
const TOKEN_LIFETIME_SECONDS = 30 * 60;

/**
 * Mint a Tiptap Cloud JWT that may write one document.
 * @see https://tiptap.dev/docs/authentication
 */
export function generateCollabToken({
  userId,
  documentName,
}: {
  userId: string;
  documentName: string;
}): string {
  const privateKey = process.env.TIPTAP_PRIVATE_KEY;
  const environmentId = process.env.TIPTAP_ENVIRONMENT_ID;

  if (!privateKey || !environmentId) {
    throw new Error(
      'TIPTAP_PRIVATE_KEY and TIPTAP_ENVIRONMENT_ID must be set to sign a Tiptap collaboration token',
    );
  }

  return jwt.sign(
    {
      // Write implies Read and Comment.
      permissions: [{ action: 'Documents:Write', resource: documentName }],
    },
    privateKey,
    {
      algorithm: 'ES256',
      issuer: environmentId,
      audience: ['Documents'],
      subject: userId,
      expiresIn: TOKEN_LIFETIME_SECONDS,
    },
  );
}
