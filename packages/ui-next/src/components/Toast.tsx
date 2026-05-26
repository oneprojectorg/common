// Thin op-specific layer over sonner. Two exports:
//   - `<Toast />`: configured Toaster mount with op defaults.
//   - `toast.status({ code, message })`: HTTP-code → canned-copy helper.
//     Callers do `toast.status({ code: error.status })` to get consistent
//     "permission needed" / "not found" / "didn't work" messaging.
//
// For everything else, import `toast` directly from `sonner`:
//   import { toast } from 'sonner';
//   toast.success('Saved', { description: 'Settings updated.' });

'use client';

import { toast as sonnerToast } from 'sonner';

import { Toaster } from './ui/sonner';

export const Toast = () => {
  return (
    <Toaster
      position="bottom-left"
      visibleToasts={3}
      duration={3000}
      closeButton
      pauseWhenPageIsHidden
    />
  );
};

export const toast = {
  status: ({ code, message }: { code: number; message?: string }) => {
    switch (code) {
      case 200:
        return;
      case 404:
        return sonnerToast.error('Oops! Not found', {
          description:
            message ??
            "We can't seem to find that. It might have been removed.",
        });
      case 403:
        return sonnerToast.error('Permission needed', {
          description:
            message ??
            "You'll need additional access to do that. Contact your organization's admin for help.",
        });
      default:
        return sonnerToast.error("That didn't work", {
          description:
            message ?? 'Something went wrong on our end. Please try again',
        });
    }
  },
};
