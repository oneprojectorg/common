'use client';

import type { ComponentProps, Ref } from 'react';
import {
  Button as AriaButton,
  Link as AriaLink,
  composeRenderProps,
} from 'react-aria-components';
import type { LinkProps as AriaLinkProps } from 'react-aria-components';

import { cn } from '../lib/utils';
import { LoadingSpinner } from './LoadingSpinner';
import { Tooltip, TooltipTrigger } from './Tooltip';
import type { TooltipProps, TooltipTriggerProps } from './Tooltip';
import { Button as TakiButton, buttonVariants } from './ui/button';

export { buttonVariants };

export type ButtonVariant = NonNullable<
  ComponentProps<typeof TakiButton>['variant']
>;
export type ButtonSize = NonNullable<ComponentProps<typeof TakiButton>['size']>;

export interface ButtonProps extends ComponentProps<typeof TakiButton> {
  /** Show a centered LoadingSpinner overlay; underlying button stays interactive-blocked via isPending. */
  isLoading?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

export const Button = ({ isLoading, children, ...props }: ButtonProps) => {
  if (!isLoading) {
    return <TakiButton {...props}>{children}</TakiButton>;
  }

  // We deliberately don't use Taki's `isPending` here — it sets
  // text-transparent on the button, which makes our spinner overlay
  // inherit color: transparent. Instead: keep the original text color,
  // hide the children with `invisible` (preserves layout), block clicks
  // with isDisabled, and override the disabled opacity so the button
  // doesn't dim while loading.
  return (
    <TakiButton
      {...props}
      isDisabled={true}
      aria-busy="true"
      className={composeRenderProps(props.className, (className) =>
        cn('relative !opacity-100', className),
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
                props.size === 'sm' || props.size === 'icon-sm'
                  ? 'size-4'
                  : 'size-5',
              )}
            />
          </span>
        </>
      )}
    </TakiButton>
  );
};

type LowLevelPressHandlers =
  | 'onPressStart'
  | 'onPressEnd'
  | 'onPressChange'
  | 'onPressUp';

export interface ButtonLinkProps extends Omit<
  AriaLinkProps,
  LowLevelPressHandlers
> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  isLoading?: boolean;
  ref?: Ref<HTMLAnchorElement>;
}

/**
 * <a> styled as a Taki Button. Same variants/sizes as Button.
 */
export const ButtonLink = ({
  variant,
  size,
  isLoading,
  children,
  ...props
}: ButtonLinkProps) => {
  const buildClass = (className: string | undefined) =>
    cn(
      buttonVariants({ variant, size }),
      isLoading && 'relative !opacity-100',
      className,
    );

  if (!isLoading) {
    return (
      <AriaLink
        {...props}
        className={composeRenderProps(props.className, (className) =>
          buildClass(className),
        )}
      >
        {composeRenderProps(children, (c) => (
          <>{c}</>
        ))}
      </AriaLink>
    );
  }

  return (
    <AriaLink
      {...props}
      aria-busy="true"
      aria-disabled="true"
      className={composeRenderProps(props.className, (className) =>
        buildClass(className),
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
                size === 'sm' || size === 'icon-sm' ? 'size-4' : 'size-5',
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

export const ButtonTooltip = ({
  triggerProps,
  tooltipProps,
  ...rest
}: ButtonTooltipProps) => {
  return (
    <TooltipTrigger {...triggerProps}>
      <Button {...rest} />
      <Tooltip {...tooltipProps} />
    </TooltipTrigger>
  );
};

/**
 * RAC Button passthrough — focus + keyboard semantics without any Taki
 * styling. Use this where the legacy `<Button unstyled>` pattern was
 * used to render a custom-styled clickable region.
 */
export const UnstyledButton = AriaButton;
