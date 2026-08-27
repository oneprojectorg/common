import { Link } from 'react-email';

/** A link inside body copy, styled to the design's weight rather than the client's default link blue. */
export const InlineLink = ({
  href,
  children,
}: {
  href: string;
  children: string;
}) => (
  <Link href={href} className="text-primary-teal font-bold underline">
    {children}
  </Link>
);
