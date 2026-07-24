import * as React from 'react';
import { SiGithub, SiLinkedin, SiX } from 'react-icons/si';

import { cn } from '../../lib/utils';

const socialLinks = [
  { href: 'https://x.com/oneproject', icon: SiX, alt: 'Twitter' },
  {
    href: 'https://www.linkedin.com/company/oneprojectorg',
    icon: SiLinkedin,
    alt: 'LinkedIn',
  },
  {
    href: 'https://github.com/oneprojectorg',
    icon: SiGithub,
    alt: 'GitHub',
  },
];

interface SocialLinksProps extends React.ComponentProps<'ul'> {
  linkClassName?: string;
  iconClassName?: string;
}

function SocialLinks({
  className,
  linkClassName,
  iconClassName,
  ...props
}: SocialLinksProps) {
  return (
    <ul
      data-slot="social-links"
      className={cn('flex gap-4', className)}
      {...props}
    >
      {socialLinks.map(({ href, icon: Icon, alt }) => (
        <li key={href}>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={alt}
            className={cn(
              'text-muted-foreground transition-colors duration-300 hover:text-foreground',
              linkClassName,
            )}
          >
            <Icon className={iconClassName} />
          </a>
        </li>
      ))}
    </ul>
  );
}

export { SocialLinks };
