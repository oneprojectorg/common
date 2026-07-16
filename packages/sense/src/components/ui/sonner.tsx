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

import { cn } from '../../lib/utils';

const Toaster = ({ className, ...props }: ToasterProps) => {
  // Default light, not 'system': sense has no dark spec, and without a
  // next-themes provider 'system' lets the OS put sonner in dark mode.
  const { theme = 'light' } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      className={cn('toaster group', className)}
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
        // layered utilities — any property sonner itself sets needs a `!`
        // modifier to land (border/title/description colors and weights;
        // button size/colors, which sonner renders as small inverted pills
        // by default). Sonner's own gap/padding/radius/shadow already match
        // the sense look, so those are left to its stylesheet.
        classNames: {
          toast: 'group/toast border-border!',
          title: 'text-base font-strong!',
          description: 'text-sm text-muted-foreground!',
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

// Re-exported so consumers (and the sense stories) can fire toasts without a
// direct dependency on the sonner package.
export { toast } from 'sonner';
export { Toaster };
