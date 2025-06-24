'use client';

import { ReactNode } from 'react';
import { LuCircleAlert, LuCircleCheck, LuX } from 'react-icons/lu';
import { Toaster as Sonner, toast as sonnerToast } from 'sonner';

import { Button } from './Button';

export const Toast = () => {
  return (
    <Sonner
      position="bottom-left"
      className="toaster group"
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
            'group relative text-5 toast bg-white rounded-lg backdrop-blur-md border border-neutral-gray1 text-neutral-black p-3 flex gap-3',
          description: 'text-neutral-charcoal',
          actionButton:
            'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
          cancelButton:
            'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
          closeButton: '!absolute !right-0 top-0',
          // error: 'text-neutral-offWhite bg-functional-red',
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
  return <div className="flex w-full flex-col gap-2 px-1">{children}</div>;
};

const ToastTitle = ({ title }: { title: string }) => {
  return <div className="font-serif text-title-base">{title}</div>;
};

export const toast = {
  success: ({
    title,
    message,
    dismissable,
  }: {
    title?: string;
    message?: ReactNode;
    dismissable?: boolean;
  }) => {
    return sonnerToast.custom((id) => (
      <ToastWrapper id={id} dismissable={dismissable}>
        <LuCircleCheck className="size-6 stroke-1 text-functional-green" />
        <ToastBody>
          {title ? <ToastTitle title={title} /> : null}
          {message ? <div>{message}</div> : null}
        </ToastBody>
      </ToastWrapper>
    ));
  },

  error: ({ title, message }: { title?: string; message?: string }) => {
    return sonnerToast.custom(
      (id) => (
        <ToastWrapper id={id}>
          <LuCircleAlert className="size-6 stroke-1 text-white" />
          <ToastBody>
            {title ? (
              <div className="text-title-base text-white">{title}</div>
            ) : null}
            {message ? <div className="text-white">{message}</div> : null}
          </ToastBody>
        </ToastWrapper>
      ),
      {
        style: {
          background: 'rgb(239 68 68)', // bg-functional-red equivalent
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
