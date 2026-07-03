import type { ComponentProps } from 'react';
import { Button, Section } from 'react-email';

const baseClassName =
  'rounded-lg bg-primary-teal px-4 py-3 text-center text-base text-white no-underline hover:bg-primary-teal/90';

export const CtaButton = ({
  className,
  children,
  ...props
}: ComponentProps<typeof Button>) => (
  <Section className="pb-0">
    <Button
      className={className ? `${baseClassName} ${className}` : baseClassName}
      {...props}
    >
      {children}
    </Button>
  </Section>
);
