export type ErrorDigest = {
  statusCode: number;
  name: string;
};

const PREFIX = 'COMMON_ERROR';

export const encodeErrorDigest = ({ statusCode, name }: ErrorDigest): string =>
  `${PREFIX};${statusCode};${name}`;

export const parseErrorDigest = (
  digest: string | undefined,
): ErrorDigest | null => {
  if (!digest) {
    return null;
  }

  const [prefix, status, name] = digest.split(';');
  if (prefix !== PREFIX || !status || !name) {
    return null;
  }

  const statusCode = Number(status);
  return Number.isInteger(statusCode) ? { statusCode, name } : null;
};
