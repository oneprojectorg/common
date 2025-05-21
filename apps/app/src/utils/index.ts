import { z } from 'zod';

export const getPublicUrl = (key?: string | null) => {
  if (!key) {
    return;
  }

  return `/assets/${key}`;
};

// There is a bug in URL() which causes most any string to pass so we need a custom regex check here that additionally checks for more practical URLs
export const zodUrlRefine = (val: string) => {
  if (!val) {
    return true;
  }

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

export const zodUrl = ({
  message,
  isRequired,
}: {
  message: string;
  isRequired?: boolean;
}) => {
  const baseValidation = z
    .string({ message })
    .max(200, { message: 'Must be at most 200 characters' })
    .refine(zodUrlRefine, {
      message,
    })
    .optional();
  const validation = isRequired
    ? baseValidation.refine((val) => val && val.trim() !== '', {
        message,
      })
    : baseValidation.optional();

  return z.preprocess((val) => {
    // Check if the URL already starts with http:// or https://
    if (
      val &&
      typeof val == 'string' &&
      !val.startsWith('http://') &&
      !val.startsWith('https://')
    ) {
      // If not, prefix with https://
      return `https://${val}`;
    }

    return val;
  }, validation);
};

export const formatToUrl = (inputString: string) => {
  // Trim any whitespace
  let url = inputString.trim();

  // Check if the URL has a protocol (http:// or https://)
  if (!url.match(/^https?:\/\//i)) {
    // If no protocol is specified, default to https://
    url = 'https://' + url;
  }

  // Remove trailing slash if present
  if (url.endsWith('/')) {
    url = url.slice(0, -1);
  }

  // Parse the URL to handle encoding properly
  try {
    const parsedUrl = new URL(url);

    // Ensure the hostname is properly formatted
    if (!parsedUrl.hostname.includes('.')) {
      throw new Error('Invalid hostname');
    }

    return parsedUrl.toString();
  } catch (error) {
    // If URL parsing fails, return null or an error message
    return '/';
  }
};
