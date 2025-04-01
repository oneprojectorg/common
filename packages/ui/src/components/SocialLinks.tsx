import { cn } from '../lib/utils';

import GithubIcon from '~icons/carbon/logo-github.jsx';
import LinkedinIcon from '~icons/carbon/logo-linkedin.jsx';
import TwitterIcon from '~icons/carbon/logo-x.jsx';

export interface SocialLink {
  href: string;
  name: keyof typeof iconMap;
  alt: string;
}

const iconMap = {
  github: GithubIcon,
  twitter: TwitterIcon,
  linkedin: LinkedinIcon,
};

const socialLinks: SocialLink[] = [
  { href: 'https://x.com/oneproject', name: 'twitter', alt: 'Twitter' },
  {
    href: 'https://www.linkedin.com/company/oneprojectorg',
    name: 'linkedin',
    alt: 'LinkedIn',
  },
  { href: 'https://github.com/oneprojectorg', name: 'github', alt: 'GitHub' },
];

export const SocialLinks = ({
  containerClassName,
  linkClassName,
  wrapperClassName,
  iconClassName,
}: {
  containerClassName?: string;
  linkClassName?: string;
  wrapperClassName?: string;
  iconClassName?: string;
}) => {
  return (
    <div className={cn('flex gap-4', containerClassName)}>
      {socialLinks.map((link) => {
        const IconComponent = iconMap[link.name];

        return (
          <div className={wrapperClassName} key={link.href}>
            <a
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={link.alt}
              className={cn('hover:text-neutral-900', linkClassName)}
            >
              <IconComponent className={iconClassName} />
            </a>
          </div>
        );
      })}
    </div>
  );
};

export const SocialLinksFooter = ({ className }: { className?: string }) => {
  return (
    <ul className={cn('flex gap-4', className)}>
      {socialLinks.map((link) => {
        const IconComponent = iconMap[link.name];

        return (
          <li key={link.href}>
            <a
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={link.alt}
              className="duration-300 hover:text-neutral-900"
            >
              <IconComponent />
            </a>
          </li>
        );
      })}
    </ul>
  );
};
