import type { ComponentProps } from 'react';
import { Text } from 'react-email';

const baseClassName = 'mb-0 text-sm text-neutral-gray4';

export const Footnote = ({
  className,
  ...props
}: ComponentProps<typeof Text>) => (
  <Text
    className={className ? `${baseClassName} ${className}` : baseClassName}
    {...props}
  />
);
