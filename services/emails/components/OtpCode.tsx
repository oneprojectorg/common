import { Section, Text } from 'react-email';

/** The one-time code block. Without `token`, GoTrue fills `{{ .Token }}` itself. */
export const OtpCode = ({ token }: { token?: string }) => (
  <Section className="mt-6 mb-6">
    <Text className="login-code bg-primary-teal m-0 block rounded-lg px-4 py-3 text-center font-mono text-xl font-medium tracking-[0.25em] whitespace-nowrap text-white md:text-2xl">
      {token ?? '{{ .Token }}'}
    </Text>
  </Section>
);
