'use client';

import * as React from 'react';
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

interface ToastInput {
  title?: React.ReactNode;
  message?: React.ReactNode;
  dismissable?: boolean;
}

type SonnerLevel = 'success' | 'error' | 'info' | 'warning' | 'message';

function fire(level: SonnerLevel) {
  return ({ title, message, dismissable }: ToastInput = {}) => {
    const headline = title ?? message ?? '';
    const description = title && message ? message : undefined;
    return sonnerToast[level](headline as string, {
      description,
      dismissible: dismissable !== false,
    });
  };
}

export const toast = {
  success: fire('success'),
  error: fire('error'),
  info: fire('info'),
  warning: fire('warning'),
  message: fire('message'),
  dismiss: sonnerToast.dismiss,
  status: ({ code, message }: { code: number; message?: string }) => {
    switch (code) {
      case 200:
        return;
      case 404:
        return toast.error({
          title: 'Oops! Not found',
          message:
            message ??
            "We can't seem to find that. It might have been removed.",
        });
      case 403:
        return toast.error({
          title: 'Permission needed',
          message:
            message ??
            "You'll need additional access to do that. Contact your organization's admin for help.",
        });
      default:
        return toast.error({
          title: "That didn't work",
          message:
            message ?? 'Something went wrong on our end. Please try again',
        });
    }
  },
};
