'use client';

import React from 'react';
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
        success: (
          <LuCircleCheck className="size-6 shrink-0 text-functional-green" />
        ),
        close: <LuX className="size-6 shrink-0 text-neutral-black" />,
        error: (
          <LuCircleAlert className="size-6 shrink-0 text-functional-red" />
        ),
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
  isSingleLine = false,
}: {
  id: string | number;
  dismissable?: boolean;
  children: React.ReactNode;
  isSingleLine?: boolean;
}) => {
  return (
    <div
      className={cn(
        'flex w-full items-start gap-2',
        isSingleLine && 'items-center',
      )}
    >
      {children}
      {dismissable && (
        <Button
          unstyled
          className="w-6 transition-opacity hover:opacity-70"
          onPress={() => sonnerToast.dismiss(id)}
        >
          <LuX className="size-6 stroke-[1.5]" />
        </Button>
      )}
    </div>
  );
};

const ToastBody = ({
  children,
  isSingleLine = false,
}: {
  children: React.ReactNode;
  isSingleLine?: boolean;
}) => {
  if (isSingleLine) {
    return (
      <div className="flex w-full min-w-0 items-center gap-2 text-base text-neutral-charcoal">
        {children}
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-2 px-1 pt-1 text-base text-neutral-charcoal">
      {children}
    </div>
  );
};

const ToastActions = ({
  children,
  isSingleLine = false,
}: {
  children: React.ReactNode;
  isSingleLine?: boolean;
}) => {
  const renderActions = () => {
    if (Array.isArray(children)) {
      return children.map((action, index) => (
        <React.Fragment key={index}>{action}</React.Fragment>
      ));
    }
    return children;
  };

  if (isSingleLine) {
    return (
      <div className="ml-auto flex shrink-0 items-center gap-2">
        {renderActions()}
      </div>
    );
  }

  return <div className="mt-2 flex gap-4">{renderActions()}</div>;
};

const ToastTitle = ({
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

const SingleLineMessage = ({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) => {
  return (
    <span className={cn('min-w-0 flex-1 truncate', className)}>{children}</span>
  );
};

export const toast = {
  success: ({
    title,
    message,
    dismissable,
    children,
    actions,
  }: {
    title?: string;
    message?: React.ReactNode;
    dismissable?: boolean;
    children?: React.ReactNode;
    actions?: [React.ReactNode, React.ReactNode?];
  }) => {
    const isSingleLine = !title;

    return sonnerToast.custom((id) => (
      <ToastWrapper
        id={id}
        dismissable={dismissable}
        isSingleLine={isSingleLine}
      >
        <LuCircleCheck className="size-6 shrink-0 stroke-[1.5] text-functional-green" />
        <ToastBody isSingleLine={isSingleLine}>
          {title && <ToastTitle>{title}</ToastTitle>}
          {message &&
            (isSingleLine ? (
              <SingleLineMessage>{message}</SingleLineMessage>
            ) : (
              <span>{message}</span>
            ))}
          {children}
          {actions && (
            <ToastActions isSingleLine={isSingleLine}>{actions}</ToastActions>
          )}
        </ToastBody>
      </ToastWrapper>
    ));
  },

  error: ({
    title,
    message,
    children,
    dismissable = true,
    actions,
  }: {
    title?: string;
    message?: React.ReactNode;
    children?: React.ReactNode;
    dismissable?: boolean;
    actions?: [React.ReactNode, React.ReactNode?];
  }) => {
    const isSingleLine = !title;

    // TODO: some odd behavior with Tailwind text-white an text-title-base conflicting here (the size gets stripped by the compiler).
    return sonnerToast.custom(
      (id) => (
        <ToastWrapper
          id={id}
          dismissable={dismissable}
          isSingleLine={isSingleLine}
        >
          <LuCircleAlert className="size-6 shrink-0 stroke-[1.5] text-white" />
          <ToastBody isSingleLine={isSingleLine}>
            {title && (
              <ToastTitle>
                <span className="text-white">{title}</span>
              </ToastTitle>
            )}
            {message &&
              (isSingleLine ? (
                <SingleLineMessage className="text-white">
                  {message}
                </SingleLineMessage>
              ) : (
                <div className="text-white">{message}</div>
              ))}
            {children}
            {actions && (
              <ToastActions isSingleLine={isSingleLine}>{actions}</ToastActions>
            )}
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
