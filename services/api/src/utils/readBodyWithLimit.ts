/**
 * A request body as text, or undefined once it passes `maxBytes`. It stops
 * reading at the limit, so an oversized body is never buffered whole.
 */
export const readBodyWithLimit = async ({
  request,
  maxBytes,
}: {
  request: Request;
  maxBytes: number;
}): Promise<string | undefined> => {
  if (!request.body) {
    return '';
  }

  const reader = request.body.getReader();
  const chunks: Array<Uint8Array> = [];
  let size = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      return undefined;
    }
    chunks.push(value);
  }

  return Buffer.concat(chunks).toString('utf8');
};
