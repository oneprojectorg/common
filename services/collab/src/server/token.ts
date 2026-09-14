import jwt from 'jsonwebtoken';

/** Tiptap Cloud tokens live for one hour; the client refetches before reconnecting. */
const TOKEN_LIFETIME_SECONDS = 60 * 60;

export interface GenerateCollabTokenInput {
  /** The authenticated user's identifier, carried as the `sub` claim. */
  userId: string;
  /** The single collaboration document this token may open. */
  documentName: string;
}

/**
 * Mint a Tiptap Cloud collaboration JWT scoped to one document.
 *
 * Signed with the same app secret the REST client uses, so Tiptap Cloud can
 * verify it. `allowedDocumentNames` holds exactly one name, so a leaked token
 * opens nothing else.
 *
 * @see https://tiptap.dev/docs/collaboration/getting-started/authenticate
 */
export function generateCollabToken({
  userId,
  documentName,
}: GenerateCollabTokenInput): string {
  const secret = process.env.TIPTAP_SECRET;

  if (!secret) {
    throw new Error(
      'TIPTAP_SECRET is not set — cannot sign a Tiptap collaboration token',
    );
  }

  return jwt.sign(
    {
      sub: userId,
      allowedDocumentNames: [documentName],
    },
    secret,
    {
      algorithm: 'HS256',
      expiresIn: TOKEN_LIFETIME_SECONDS,
    },
  );
}
