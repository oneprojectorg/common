import { z } from 'zod';

export const getPublicUrl = (key?: string | null) => {
  if (!key) {
    return;
  }

  return `/assets/${key}`;
};

// There is a bug in URL() which causes most any string to pass so we need a custom regex check here that additionally checks for more practical URLs
export const zodUrlRefine = (val: string) => {
  const urlPattern = new RegExp(
    '^(https?:\\/\\/)?' + // protocol
      '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|' + // domain name
      '((\\d{1,3}\\.){3}\\d{1,3}))' + // OR ip (v4) address
      '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*' + // port and path
      '(\\?[;&a-z\\d%_.~+=-]*)?' + // query string
      '(\\#[-a-z\\d_]*)?$',
    'i', // fragment locator
  );

  return urlPattern.test(val);
};

export const zodUrl = ({ message }: { message: string }) => {
  return z.preprocess(
    (val) => {
      // Check if the URL already starts with http:// or https://
      if (
        typeof val == 'string' &&
        !val.startsWith('http://') &&
        !val.startsWith('https://')
      ) {
        // If not, prefix with https://
        return `https://${val}`;
      }

      return String(val);
    },
    z
      .string({ message })
      .url({ message })
      .min(1, { message: 'Must be at least 1 character' })
      .max(200, { message: 'Must be at most 200 characters' })
      .refine(zodUrlRefine)
      .optional(),
  );
};
