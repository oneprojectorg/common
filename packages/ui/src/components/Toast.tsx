'use client';

import { LuCircleAlert, LuCircleCheck, LuX } from 'react-icons/lu';
import { Toaster as Sonner } from 'sonner';

export const Toast = () => {
  return (
    <Sonner
      position="bottom-center"
      className="toaster group"
      pauseWhenPageIsHidden
      duration={5 * 60 * 1000}
      visibleToasts={10}
      icons={{
        success: <LuCircleCheck className="size-6 text-functional-green" />,
        close: <LuX className="size-6 text-neutral-black" />,
        error: <LuCircleAlert className="size-6 text-functional-red" />,
      }}
      toastOptions={{
        classNames: {
          toast:
            'group font-serif relative text-5 toast bg-neutral-offWhite backdrop-blur-md border border-neutral-gray1 text-neutral-black p-3 flex gap-3',
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
