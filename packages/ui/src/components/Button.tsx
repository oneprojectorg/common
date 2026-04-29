'use client';

import type { Ref } from 'react';
import {
  Button as AriaButton,
  Link as AriaLink,
  composeRenderProps,
} from 'react-aria-components';
import type {
  ButtonProps as AriaButtonProps,
  LinkProps as AriaLinkProps,
} from 'react-aria-components';

import { cn } from '../lib/utils';
import { LoadingSpinner } from './LoadingSpinner';
import { Tooltip, TooltipTrigger } from './Tooltip';
import type { TooltipProps, TooltipTriggerProps } from './Tooltip';
import { buttonVariants } from './ui/button';

type TakiVariant =
  | 'default'
  | 'destructive'
  | 'outline'
  | 'secondary'
  | 'ghost'
  | 'link';
type TakiSize = 'default' | 'sm' | 'lg' | 'icon' | 'icon-sm' | 'icon-lg';

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

interface SharedButtonStyleProps {
  variant?: LegacyVariant;
  color?: LegacyColor;
  size?: LegacySize;
  surface?: 'solid' | 'outline' | 'ghost';
  unstyled?: boolean;
  scaleOnPress?: boolean;
  insetShadow?: boolean;
  backglow?: boolean;
}

function resolveTakiVariant(
  variant: LegacyVariant | undefined,
  color: LegacyColor | undefined,
): TakiVariant {
  if (variant === 'link') return 'link';
  if (color === 'destructive') return 'destructive';
  if (color === 'ghost') return 'ghost';
  if (color === 'secondary' || color === 'neutral') return 'outline';
  if (color === 'unverified' || color === 'verified') return 'outline';
  return 'default';
}

function resolveTakiSize(size: LegacySize | undefined): TakiSize {
  if (size === 'small') return 'sm';
  if (size === 'inline') return 'default';
  return 'default';
}

function buildClassName(
  props: SharedButtonStyleProps & { className?: string; isLoading?: boolean },
  renderProps: { isDisabled?: boolean; isPending?: boolean },
): string {
  if (props.unstyled) return props.className ?? '';

  const extra = cn(
    props.size === 'inline' && 'h-auto rounded-none p-0 shadow-none',
    props.isLoading && 'relative',
    props.className,
  );

  return buttonVariants({
    variant: resolveTakiVariant(props.variant, props.color),
    size: resolveTakiSize(props.size),
    isDisabled: props.isLoading ? false : renderProps.isDisabled,
    isPending: props.isLoading || renderProps.isPending,
    className: extra,
  });
}

export interface ButtonProps
  extends AriaButtonProps,
    SharedButtonStyleProps {
  className?: string;
  isLoading?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

export const Button = (props: ButtonProps) => {
  const {
    variant,
    color,
    size,
    surface,
    unstyled,
    scaleOnPress,
    insetShadow,
    backglow,
    isLoading,
    children,
    ...rest
  } = props;

  if (!isLoading) {
    return (
      <AriaButton
        {...rest}
        className={composeRenderProps(props.className, (className, renderProps) =>
          buildClassName(
            { variant, color, size, surface, unstyled, scaleOnPress, insetShadow, backglow, className },
            renderProps,
          ),
        )}
      >
        {composeRenderProps(children, (c) => <>{c}</>)}
      </AriaButton>
    );
  }

  return (
    <AriaButton
      {...rest}
      isPending
      className={composeRenderProps(props.className, (className, renderProps) =>
        buildClassName(
          { variant, color, size, surface, unstyled, scaleOnPress, insetShadow, backglow, className, isLoading: true },
          renderProps,
        ),
      )}
    >
      {(renderProps) => (
        <>
          <span className="invisible flex items-center gap-1">
            {typeof children === 'function' ? children(renderProps) : children}
          </span>
          <span className="absolute inset-0 flex items-center justify-center">
            <LoadingSpinner
              className={cn(
                'fill-transparent text-current',
                size === 'small' ? 'size-4' : 'size-5',
              )}
            />
          </span>
        </>
      )}
    </AriaButton>
  );
};

type LowLevelPressHandlers =
  | 'onPressStart'
  | 'onPressEnd'
  | 'onPressChange'
  | 'onPressUp';

export interface ButtonLinkProps
  extends Omit<AriaLinkProps, LowLevelPressHandlers>,
    SharedButtonStyleProps {
  className?: string;
  isLoading?: boolean;
  ref?: Ref<HTMLAnchorElement>;
}

export const ButtonLink = (props: ButtonLinkProps) => {
  const {
    variant,
    color,
    size,
    surface,
    unstyled,
    scaleOnPress,
    insetShadow,
    backglow,
    isLoading,
    children,
    ...rest
  } = props;

  if (!isLoading) {
    return (
      <AriaLink
        {...rest}
        className={composeRenderProps(props.className, (className, renderProps) =>
          buildClassName(
            { variant, color, size, surface, unstyled, scaleOnPress, insetShadow, backglow, className },
            renderProps,
          ),
        )}
      >
        {composeRenderProps(children, (c) => <>{c}</>)}
      </AriaLink>
    );
  }

  return (
    <AriaLink
      {...rest}
      aria-busy="true"
      aria-disabled="true"
      className={composeRenderProps(props.className, (className, renderProps) =>
        buildClassName(
          { variant, color, size, surface, unstyled, scaleOnPress, insetShadow, backglow, className, isLoading: true },
          renderProps,
        ),
      )}
    >
      {(renderProps) => (
        <>
          <span className="invisible flex items-center gap-1">
            {typeof children === 'function' ? children(renderProps) : children}
          </span>
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <LoadingSpinner
              className={cn(
                'fill-transparent text-current',
                size === 'small' ? 'size-4' : 'size-5',
              )}
            />
          </span>
        </>
      )}
    </AriaLink>
  );
};

export interface ButtonTooltipProps extends ButtonProps {
  triggerProps?: Omit<TooltipTriggerProps, 'children'>;
  tooltipProps: TooltipProps;
}

export const ButtonTooltip = (props: ButtonTooltipProps) => {
  const { triggerProps, tooltipProps, ...rest } = props;
  return (
    <TooltipTrigger {...triggerProps}>
      <Button {...rest} />
      <Tooltip {...tooltipProps} />
    </TooltipTrigger>
  );
};
