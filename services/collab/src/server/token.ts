import jwt from 'jsonwebtoken';

/**
 * Tiptap asks for 30 minutes or less. The client refetches a token once it is
 * five minutes old, so a live session never presents an expired one.
 */
const TOKEN_LIFETIME_SECONDS = 30 * 60;

export interface GenerateCollabTokenInput {
  /** The authenticated user's identifier, carried as the `sub` claim. */
  userId: string;
  /** The single collaboration document this token may open. */
  documentName: string;
}

/**
 * Mint a Tiptap Cloud collaboration JWT scoped to one document.
 *
 * Signed with the ES256 private key of a key pair created in the Tiptap
 * dashboard, issued for that dashboard environment. The `permissions` name
 * exactly one resource, so a leaked token opens nothing else.
 *
 * @see https://tiptap.dev/docs/authentication
 */
export function generateCollabToken({
  userId,
  documentName,
}: GenerateCollabTokenInput): string {
  const privateKey = process.env.TIPTAP_PRIVATE_KEY;
  const environmentId = process.env.TIPTAP_ENVIRONMENT_ID;

  if (!privateKey || !environmentId) {
    throw new Error(
      'TIPTAP_PRIVATE_KEY and TIPTAP_ENVIRONMENT_ID must be set to sign a Tiptap collaboration token',
    );
  }

  return jwt.sign(
    {
      permissions: [
        { action: 'Documents:Read', resource: documentName },
        { action: 'Documents:Write', resource: documentName },
      ],
    },
    // A PEM kept on one line, as most env editors store it, carries literal `\n`.
    privateKey.replace(/\\n/g, '\n'),
    {
      algorithm: 'ES256',
      issuer: environmentId,
      audience: ['Documents'],
      subject: userId,
      expiresIn: TOKEN_LIFETIME_SECONDS,
    },
  );
}
