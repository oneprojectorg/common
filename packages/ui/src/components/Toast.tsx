'use client';

import { ReactNode } from 'react';
import { LuCircleAlert, LuCircleCheck, LuX } from 'react-icons/lu';
import { Toaster as Sonner, toast as sonnerToast } from 'sonner';

import { cn } from '../lib/utils';
import { Button } from './Button';

export const Toast = () => {
  return (
    <Sonner
      position="bottom-left"
      className="toaster group w-[27rem]"
      pauseWhenPageIsHidden
      visibleToasts={3}
      duration={3000}
      icons={{
        success: <LuCircleCheck className="size-6 text-functional-green" />,
        close: <LuX className="size-6 text-neutral-black" />,
        error: <LuCircleAlert className="size-6 text-functional-red" />,
      }}
      toastOptions={{
        classNames: {
          toast:
            'group relative text-5 toast bg-neutral-offWhite rounded-lg backdrop-blur-md border border-neutral-gray1 text-neutral-black p-3 flex gap-3',
          description: 'text-neutral-charcoal',
          actionButton:
            'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
          cancelButton:
            'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
          closeButton: '!absolute !right-0 top-0',
        },
      }}
    />
  );
};

const ToastWrapper = ({
  id,
  dismissable = false,
  children,
}: {
  id: string | number;
  dismissable?: boolean;
  children: React.ReactNode;
}) => {
  return (
    <div className="flex w-full items-start gap-2">
      {children}
      {dismissable && (
        <Button
          unstyled
          className="w-6 transition-opacity hover:opacity-70"
          onPress={() => sonnerToast.dismiss(id)}
        >
          <LuX className="size-6 stroke-1" />
        </Button>
      )}
    </div>
  );
};

const ToastBody = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="flex w-full flex-col gap-2 px-1 pt-1 text-base text-neutral-charcoal">
      {children}
    </div>
  );
};

const ToastTitle = ({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) => {
  return (
    <div className="font-serif text-title-base text-neutral-black">
      {children}
    </div>
  );
};

export const toast = {
  success: ({
    title,
    message,
    dismissable,
    children,
  }: {
    title?: string;
    message?: ReactNode;
    dismissable?: boolean;
    children?: React.ReactNode;
  }) => {
    return sonnerToast.custom((id) => (
      <ToastWrapper id={id} dismissable={dismissable}>
        <LuCircleCheck className="size-6 stroke-1 text-functional-green" />
        <ToastBody>
          {title ? <ToastTitle>{title}</ToastTitle> : null}
          {message ? <div>{message}</div> : null}
          {children}
        </ToastBody>
      </ToastWrapper>
    ));
  },

  error: ({
    title,
    message,
    children,
    dismissable = true,
  }: {
    title?: string;
    message?: string;
    children?: React.ReactNode;
    dismissable?: boolean;
  }) => {
    // TODO: some odd behavior with Tailwind text-white an text-title-base conflicting here (the size gets stripped by the compiler).
    return sonnerToast.custom(
      (id) => (
        <ToastWrapper id={id} dismissable={true}>
          <LuCircleAlert className="size-6 stroke-1 text-white" />
          <ToastBody>
            {title ? (
              <ToastTitle>
                <span className="text-white">{title}</span>
              </ToastTitle>
            ) : null}
            {message ? <div className="text-white">{message}</div> : null}
            {children}
          </ToastBody>
        </ToastWrapper>
      ),
      {
        style: {
          background: 'rgb(203 57 5)', // bg-functional-redBlack equivalent
          color: 'white',
          border: 'none',
        },
      },
    );
  },

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
