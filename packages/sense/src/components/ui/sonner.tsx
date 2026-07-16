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
  // Default light, not 'system': sense has no dark spec, and without a
  // next-themes provider 'system' lets the OS put sonner in dark mode.
  const { theme = 'light' } = useTheme();

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
        // Sonner ships its own unlayered stylesheet, which beats Tailwind's
        // layered utilities — the `!` modifiers below are required on every
        // property sonner itself sets (toast border; button size/colors,
        // which sonner renders as small inverted pills by default).
        classNames: {
          toast:
            'group/toast gap-2 rounded-lg border border-border! p-4 shadow-[0_4px_12px_-1px_rgb(0_0_0_/_0.10)]',
          title: 'text-base font-strong',
          description: 'text-sm text-muted-foreground',
          actionButton:
            'h-8! rounded-md! bg-primary! px-2.5! text-sm! font-strong text-primary-foreground!',
          cancelButton:
            'h-8! rounded-md! bg-secondary! px-2.5! text-sm! font-strong text-foreground!',
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
