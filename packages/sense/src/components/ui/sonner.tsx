'use client';

import { useTheme } from 'next-themes';
import {
  LuCircleCheck,
  LuInfo,
  LuTriangleAlert,
  LuOctagonX,
  LuLoaderCircle,
} from 'react-icons/lu';
import { Toaster as Sonner, type ToasterProps } from 'sonner';

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = 'system' } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      className="toaster group"
      icons={{
        success: <LuCircleCheck className="size-4" />,
        info: <LuInfo className="size-4" />,
        warning: <LuTriangleAlert className="size-4" />,
        error: <LuOctagonX className="size-4" />,
        loading: <LuLoaderCircle className="size-4 animate-spin" />,
      }}
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
          '--border-radius': 'var(--radius)',
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast:
            'group/toast gap-2 rounded-lg border p-4 shadow-[0_4px_12px_-1px_rgb(0_0_0_/_0.10)]',
          title: 'text-base font-strong',
          description: 'text-sm text-muted-foreground',
          actionButton:
            'bg-primary text-primary-foreground rounded-md text-sm font-strong',
          cancelButton:
            'bg-secondary text-foreground rounded-md text-sm font-strong',
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
