import type { ComponentProps } from 'react';
import { Button, Section } from 'react-email';

export const CtaButton = ({
  children,
  ...props
}: ComponentProps<typeof Button>) => (
  <Section className="pb-0">
    <Button
      className="rounded-lg bg-primary-teal px-4 py-3 text-white no-underline hover:bg-primary-teal/90"
      style={{
        fontSize: '0.875rem',
        textAlign: 'center',
        textDecoration: 'none',
      }}
      {...props}
    >
      {children}
    </Button>
  </Section>
);
