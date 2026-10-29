import {
  AUTH_EMAIL_HOOK_MAX_BODY_BYTES,
  type AuthEmailHookRequest,
} from './handleAuthEmailHook';

/**
 * Reads the hook request verbatim, since the signature covers the exact
 * bytes, but stops at the size cap instead of buffering an unauthenticated
 * body of any length. `undefined` means the body was over the cap.
 */
export const readAuthEmailHookRequest = async (
  request: Request,
  maxBytes = AUTH_EMAIL_HOOK_MAX_BODY_BYTES,
): Promise<AuthEmailHookRequest | undefined> => {
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });

  if (!request.body) {
    return { rawBody: '', headers };
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return undefined;
    }
    chunks.push(value);
  }

  return { rawBody: Buffer.concat(chunks).toString('utf8'), headers };
};
