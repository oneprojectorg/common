import { toast } from '@op/sense/Toast';

import type { TranslateFn } from '@/lib/i18n';

/**
 * Replacement for `@op/ui`'s `toast.status(...)`. Maps an HTTP-ish
 * status code to a titled error toast, mirroring the old @op/ui behavior:
 * 200 is a no-op, 404/403 get specific titles, everything else falls back to a
 * generic failure. Titles/fallbacks are translated (pass the caller's `t`).
 * Accepts a loose arg so callers can pass either `{ code, message }` or a caught
 * error (whose `.message` becomes the description).
 */
export const toastStatus = (
  t: TranslateFn,
  arg?: { code?: number; message?: string } | null,
) => {
  const code = arg?.code;
  const message = arg?.message;

  switch (code) {
    case 200:
      return;
    case 404:
      return toast.error(t('Oops! Not found'), {
        description:
          message ??
          t("We can't seem to find that. It might have been removed."),
      });
    case 403:
      return toast.error(t('Permission needed'), {
        description:
          message ??
          t(
            "You'll need additional access to do that. Contact your organization's admin for help.",
          ),
      });
    default:
      return toast.error(t("That didn't work"), {
        description:
          message ?? t('Something went wrong on our end. Please try again'),
      });
  }
};
