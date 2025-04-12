'use client';

import { AlertCircleIcon, InfoIcon } from 'lucide-react';
import { chain } from 'react-aria';

import { Button } from './Button';
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
} from './Dialog';

import type { DialogProps } from './Dialog';
import type { ReactNode } from 'react';

interface AlertDialogProps extends Omit<DialogProps, 'children'> {
  title: string;
  children: ReactNode;
  variant?: 'info' | 'destructive';
  actionLabel: string;
  cancelLabel?: string;
  onAction?: () => void;
}

export const AlertDialog = ({
  title,
  variant,
  cancelLabel,
  actionLabel,
  onAction,
  children,
  ...props
}: AlertDialogProps) => {
  return (
    <Dialog role="alertdialog" {...props}>
      {({ close }) => (
        <>
          <DialogHeader>{title}</DialogHeader>

          <div
            className={`absolute right-6 top-6 size-6 stroke-2 ${variant === 'destructive' ? 'text-red-500' : 'text-neutral-500'}`}
          >
            {variant === 'destructive'
              ? (
                  <AlertCircleIcon aria-hidden />
                )
              : (
                  <InfoIcon aria-hidden />
                )}
          </div>
          <DialogDescription>{children}</DialogDescription>
          <DialogFooter>
            <Button
              color="primary"
              surface="solid"
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
              className="border-neutral-200 text-sm font-medium"
              scaleOnPress
              onPress={close}
            >
              {cancelLabel || 'Cancel'}
            </Button>
            <Button
              color={variant === 'destructive' ? 'destructive' : 'primary'}
              surface="solid"
              className="text-sm font-medium"
              scaleOnPress
              onPress={chain(onAction, close)}
            >
              {actionLabel}
            </Button>
          </DialogFooter>
        </>
      )}
    </Dialog>
  );
};
