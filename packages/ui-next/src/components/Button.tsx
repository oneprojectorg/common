// Compatibility wrapper bridging @op/ui's Button API to the shadcn base-nova
// Button primitive. Goal: existing call sites swap import paths only.
//
// Prop translation:
//   @op/ui                          shadcn (base-nova)
//   ------------------------------  ----------------------------
//   variant="primary"               variant="default"
//   variant="icon"                  size="icon" (variant unchanged)
//   variant="link"                  variant="link"
//   variant="pill"                  variant="secondary" + pill classes
//   color="primary"                 variant="default"
//   color="secondary"               variant="outline"
//   color="neutral"                 variant="outline"
//   color="destructive"             variant="destructive"
//   color="ghost"                   variant="ghost"
//   color="gradient"                variant="default" + gradient classes
//   color="unverified"|"verified"   variant="outline" + tint classes
//   size="small"                    size="sm"
//   size="medium"                   size="default"
//   size="inline"                   no shadcn size; passes-through with class override
//   surface="outline"               forces variant="outline"
//   surface="ghost"                 forces variant="ghost"
//   isDisabled / disabled           disabled
//   isLoading                       disabled + Spinner overlay
//   isPending                       disabled + Spinner overlay
//   onPress                         onClick
//   className                       className (merged after computed variants)
//
// Props that no longer apply (scaleOnPress, insetShadow, backglow, unstyled) are
// accepted for source compatibility but only `unstyled` has an effect (it skips
// variant class application entirely).

import * as React from 'react';

import { cn } from '@/lib/utils';

import { Button as ShadcnButton, buttonVariants } from '@/components/ui/button';

import { LoadingSpinner } from './LoadingSpinner';

type ShadcnVariant = NonNullable<
  Parameters<typeof buttonVariants>[0]
>['variant'];
type ShadcnSize = NonNullable<Parameters<typeof buttonVariants>[0]>['size'];

type LegacyVariant = 'primary' | 'icon' | 'pill' | 'link';
type LegacyColor =
  | 'primary'
  | 'secondary'
  | 'gradient'
  | 'unverified'
  | 'verified'
  | 'neutral'
  | 'destructive'
  | 'ghost'
  | 'pill';
type LegacySize = 'small' | 'medium' | 'inline';
type LegacySurface = 'solid' | 'outline' | 'ghost';

export interface ButtonProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'color' | 'size'
> {
  variant?: LegacyVariant;
  color?: LegacyColor;
  size?: LegacySize;
  surface?: LegacySurface;
  isDisabled?: boolean;
  isLoading?: boolean;
  isPending?: boolean;
  onPress?: React.MouseEventHandler<HTMLButtonElement>;
  unstyled?: boolean;
  scaleOnPress?: boolean;
  insetShadow?: boolean;
  backglow?: boolean;
}

function mapVariant({
  variant,
  color,
  surface,
}: {
  variant?: LegacyVariant;
  color?: LegacyColor;
  surface?: LegacySurface;
}): { variant: ShadcnVariant; extra: string } {
  if (surface === 'outline') return { variant: 'outline', extra: '' };
  if (surface === 'ghost') return { variant: 'ghost', extra: '' };

  if (variant === 'link') return { variant: 'link', extra: '' };
  if (variant === 'pill') {
    return {
      variant: 'secondary',
      extra: 'rounded-full px-3',
    };
  }

  switch (color) {
    case 'destructive':
      return { variant: 'destructive', extra: '' };
    case 'ghost':
      return { variant: 'ghost', extra: '' };
    case 'secondary':
    case 'neutral':
      return { variant: 'outline', extra: '' };
    case 'unverified':
    case 'verified':
      return {
        variant: 'outline',
        extra: 'border-primary/30 bg-primary/5 text-primary',
      };
    case 'gradient':
      return {
        variant: 'default',
        extra:
          'bg-gradient-to-r from-primary to-primary/70 text-primary-foreground',
      };
    case 'pill':
      return { variant: 'secondary', extra: 'rounded-full px-3' };
    case 'primary':
    default:
      return { variant: 'default', extra: '' };
  }
}

function mapSize(
  size: LegacySize | undefined,
  variant: LegacyVariant | undefined,
): { size: ShadcnSize; extra: string } {
  if (variant === 'icon') {
    switch (size) {
      case 'small':
        return { size: 'icon-sm', extra: '' };
      case 'inline':
        return { size: 'icon-xs', extra: '' };
      case 'medium':
      default:
        return { size: 'icon', extra: '' };
    }
  }

  switch (size) {
    case 'small':
      return { size: 'sm', extra: '' };
    case 'inline':
      return { size: 'default', extra: 'h-auto p-0 shadow-none' };
    case 'medium':
    default:
      return { size: 'default', extra: '' };
  }
}

export function Button(props: ButtonProps) {
  const {
    variant,
    color,
    size,
    surface,
    isDisabled,
    isLoading,
    isPending,
    onPress,
    onClick,
    unstyled,
    scaleOnPress: _scale,
    insetShadow: _inset,
    backglow: _back,
    className,
    disabled,
    children,
    ...rest
  } = props;

  const loading = !!(isLoading || isPending);
  const isDisabledFinal = disabled || isDisabled || loading;

  if (unstyled) {
    return (
      <button
        type="button"
        data-slot="button"
        disabled={isDisabledFinal}
        onClick={onClick ?? onPress}
        className={className}
        {...rest}
      >
        {children}
      </button>
    );
  }

  const { variant: shadcnVariant, extra: variantExtra } = mapVariant({
    variant,
    color,
    surface,
  });
  const { size: shadcnSize, extra: sizeExtra } = mapSize(size, variant);

  return (
    <ShadcnButton
      variant={shadcnVariant}
      size={shadcnSize}
      disabled={isDisabledFinal}
      onClick={onClick ?? onPress}
      className={cn(variantExtra, sizeExtra, loading && 'relative', className)}
      {...rest}
    >
      {loading ? (
        <>
          <span className="flex items-center gap-1 opacity-0">{children}</span>
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <LoadingSpinner
              className={cn(
                'text-current',
                size === 'small' ? 'size-4' : 'size-5',
              )}
            />
          </span>
        </>
      ) : (
        children
      )}
    </ShadcnButton>
  );
}

// ButtonLink: anchor-rendered Button. shadcn pattern uses `render` prop on
// base-ui Button or just plain <a className={buttonVariants(...)}>.
export interface ButtonLinkProps extends Omit<
  React.AnchorHTMLAttributes<HTMLAnchorElement>,
  'color' | 'size'
> {
  variant?: LegacyVariant;
  color?: LegacyColor;
  size?: LegacySize;
  surface?: LegacySurface;
  unstyled?: boolean;
  isDisabled?: boolean;
  isLoading?: boolean;
  isPending?: boolean;
}

export function ButtonLink(props: ButtonLinkProps) {
  const {
    variant,
    color,
    size,
    surface,
    href,
    target,
    rel,
    className,
    children,
    unstyled,
    isDisabled,
    isLoading,
    isPending,
    ...rest
  } = props;

  const loading = !!(isLoading || isPending);

  if (unstyled) {
    return (
      <a
        href={href}
        target={target}
        rel={rel}
        aria-disabled={isDisabled || loading || undefined}
        className={className}
        {...rest}
      >
        {children}
      </a>
    );
  }

  const { variant: shadcnVariant, extra: variantExtra } = mapVariant({
    variant,
    color,
    surface,
  });
  const { size: shadcnSize, extra: sizeExtra } = mapSize(size, variant);

  return (
    <a
      href={href}
      target={target}
      rel={rel}
      aria-disabled={isDisabled || loading || undefined}
      className={cn(
        buttonVariants({ variant: shadcnVariant, size: shadcnSize }),
        variantExtra,
        sizeExtra,
        loading && 'pointer-events-none relative',
        isDisabled && 'pointer-events-none opacity-50',
        className,
      )}
      {...rest}
    >
      {loading ? (
        <>
          <span className="flex items-center gap-1 opacity-0">{children}</span>
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <LoadingSpinner className="size-4 text-current" />
          </span>
        </>
      ) : (
        children
      )}
    </a>
  );
}

// ButtonTooltip: Button + Tooltip composite. Mirrors @op/ui's API:
//   <ButtonTooltip triggerProps={{ delay: 500 }} tooltipProps={{ children: 'Hint' }} {...buttonProps} />
import {
  Tooltip,
  TooltipTrigger,
  type TooltipProps,
  type TooltipTriggerProps,
} from './Tooltip';

export interface ButtonTooltipProps extends ButtonProps {
  triggerProps?: Omit<TooltipTriggerProps, 'children'>;
  tooltipProps: TooltipProps;
}

export function ButtonTooltip(props: ButtonTooltipProps) {
  const { triggerProps, tooltipProps, ...buttonProps } = props;

  return (
    <TooltipTrigger {...triggerProps}>
      <Button {...buttonProps} />
      <Tooltip {...tooltipProps} />
    </TooltipTrigger>
  );
}

export { buttonVariants };
