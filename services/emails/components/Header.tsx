import type { ComponentProps } from 'react';
import { Heading } from 'react-email';

const baseClassName =
  'mx-0 !my-0 p-0 text-left font-serif text-[28px] leading-[150%] font-light tracking-[-0.02625rem] text-[#222D38]';

export const Header = ({
  className,
  ...props
}: ComponentProps<typeof Heading>) => (
  <Heading
    className={className ? `${baseClassName} ${className}` : baseClassName}
    {...props}
  />
);
