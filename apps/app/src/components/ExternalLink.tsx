import type { AnchorHTMLAttributes, ReactNode } from 'react';

type ExternalLinkProps = Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  'target' | 'rel'
> & {
  children: ReactNode;
  /**
   * Stop click/pointer events from reaching ancestors. Use when the link
   * sits inside a React Aria pressable (Checkbox, Button) that would
   * otherwise toggle when the link is pressed.
   */
  stopPropagation?: boolean;
};

export const ExternalLink = ({
  stopPropagation,
  onClick,
  onPointerDown,
  ...rest
}: ExternalLinkProps) => (
  <a
    target="_blank"
    rel="noreferrer"
    {...rest}
    onClick={(event) => {
      if (stopPropagation) {
        event.stopPropagation();
      }
      onClick?.(event);
    }}
    onPointerDown={(event) => {
      if (stopPropagation) {
        event.stopPropagation();
      }
      onPointerDown?.(event);
    }}
  />
);
