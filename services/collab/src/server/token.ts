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
 * Uses Tiptap's legacy `allowedDocumentNames` format, signed with the same
 * app secret the REST client uses. Tiptap routes tokens in this format to the
 * previous verification path automatically; the newer key-pair scheme with
 * `permissions` claims is a separate migration.
 *
 * @see https://tiptap.dev/docs/authentication/legacy
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
