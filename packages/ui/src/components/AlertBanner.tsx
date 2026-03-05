import { ReactNode } from 'react';
import { LuCircleAlert, LuCircleCheck, LuInfo } from 'react-icons/lu';
import { tv } from 'tailwind-variants';

import { cn } from '../lib/utils';

const alertBannerStyles = tv({
  slots: {
    root: 'w-full overflow-hidden rounded-lg border p-4 *:[a]:hover:underline **:[strong]:font-medium',
    indicatorOuter:
      'me-3 grid size-8 place-content-center rounded-full border-2',
    indicatorInner: 'grid size-6 place-content-center rounded-full border-2',
    content: 'text-pretty',
  },
  variants: {
    intent: {
      default: {
        root: 'bg-muted/50 text-secondary-fg',
      },
      info: {
        root: 'bg-info-subtle text-info-subtle-fg **:[.text-muted-fg]:text-info-subtle-fg/70',
        indicatorOuter: 'border-info-subtle-fg/40',
        indicatorInner: 'border-info-subtle-fg/85',
      },
      warning: {
        root: 'bg-warning-subtle text-warning-subtle-fg **:[.text-muted-fg]:text-warning-subtle-fg/80',
        indicatorOuter: 'border-warning-subtle-fg/40',
        indicatorInner: 'border-warning-subtle-fg/85',
      },
      danger: {
        root: 'bg-danger-subtle text-danger-subtle-fg **:[.text-muted-fg]:text-danger-subtle-fg/80',
        indicatorOuter: 'border-danger-subtle-fg/40',
        indicatorInner: 'border-danger-subtle-fg/85',
      },
      success: {
        root: 'bg-success-subtle text-success-subtle-fg **:[.text-muted-fg]:text-success-subtle-fg/80',
        indicatorOuter: 'border-success-subtle-fg/40',
        indicatorInner: 'border-success-subtle-fg/85',
      },
    },
    variant: {
      default: {
        root: 'grid grid-cols-[auto_1fr] text-base/6 backdrop-blur-2xl sm:text-sm/6',
        content: 'group-has-data-[slot=icon]:col-start-2',
      },
      banner: {
        root: 'flex items-center gap-1 shadow-light',
        content: 'flex min-w-0 items-center gap-1',
      },
    },
  },
  compoundVariants: [
    {
      variant: 'banner',
      intent: 'warning',
      class: {
        root: 'border-primary-orange1 text-neutral-black [background:linear-gradient(rgba(255,255,255,0.92),rgba(255,255,255,0.92)),var(--color-primary-orange1)]',
      },
    },
    {
      variant: 'banner',
      intent: 'danger',
      class: {
        root: 'border-functional-red text-neutral-black [background:linear-gradient(rgba(255,255,255,0.96),rgba(255,255,255,0.96)),var(--color-functional-red)]',
      },
    },
    {
      variant: 'banner',
      intent: 'default',
      class: {
        root: 'border-neutral-gray2 bg-neutral-offWhite text-neutral-black',
      },
    },
  ],
  defaultVariants: {
    intent: 'default',
    variant: 'default',
  },
});

const iconMap: Record<
  string,
  React.ComponentType<{ className?: string }> | null
> = {
  info: LuInfo,
  warning: LuCircleAlert,
  danger: LuCircleAlert,
  success: LuCircleCheck,
  default: null,
};

export interface AlertBannerProps
  extends React.HtmlHTMLAttributes<HTMLDivElement> {
  intent?: 'default' | 'info' | 'warning' | 'danger' | 'success';
  variant?: 'default' | 'banner';
  indicator?: boolean;
  icon?: ReactNode;
  contentClassName?: string;
}

export function AlertBanner({
  indicator = true,
  intent = 'default',
  variant = 'default',
  icon,
  className,
  contentClassName,
  ...props
}: AlertBannerProps) {
  const styles = alertBannerStyles({ intent, variant });
  const IconComponent = iconMap[intent] || null;

  return (
    <div data-slot="note" className={cn(styles.root(), className)} {...props}>
      {variant === 'banner' ? (
        <>
          <span className="shrink-0 [&>svg]:size-4">
            {icon ?? <LuInfo className="size-4" />}
          </span>
          <span className="truncate text-sm leading-[1.5] font-normal">
            {props.children}
          </span>
        </>
      ) : (
        <>
          {IconComponent && indicator && (
            <div className={styles.indicatorOuter()}>
              <div className={styles.indicatorInner()}>
                <IconComponent className="size-5 shrink-0" />
              </div>
            </div>
          )}
          <div className={cn(styles.content(), contentClassName)}>
            {props.children}
          </div>
        </>
      )}
    </div>
  );
}
