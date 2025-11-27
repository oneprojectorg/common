import { cn } from '../lib/utils';

const GithubIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 32 32"
    fill="currentColor"
    className={className}
  >
    <path
      fillRule="evenodd"
      d="M16 2a14 14 0 0 0-4.43 27.28c.7.13 1-.3 1-.67v-2.38c-3.89.84-4.71-1.88-4.71-1.88a3.7 3.7 0 0 0-1.62-2.05c-1.27-.86.1-.85.1-.85a2.94 2.94 0 0 1 2.14 1.45a3 3 0 0 0 4.08 1.16a2.93 2.93 0 0 1 .88-1.87c-3.1-.36-6.37-1.56-6.37-6.92a5.4 5.4 0 0 1 1.44-3.76a5 5 0 0 1 .14-3.7s1.17-.38 3.85 1.43a13.3 13.3 0 0 1 7 0c2.67-1.81 3.84-1.43 3.84-1.43a5 5 0 0 1 .14 3.7a5.4 5.4 0 0 1 1.44 3.76c0 5.38-3.27 6.56-6.39 6.91a3.33 3.33 0 0 1 .95 2.59v3.84c0 .46.25.81 1 .67A14 14 0 0 0 16 2"
    />
  </svg>
);

const LinkedinIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 32 32"
    fill="currentColor"
    className={className}
  >
    <path d="M26.21 4H5.79A1.78 1.78 0 0 0 4 5.73v20.54A1.78 1.78 0 0 0 5.79 28h20.42A1.78 1.78 0 0 0 28 26.27V5.73A1.78 1.78 0 0 0 26.21 4M11.11 24.41H7.59V13h3.52zm-1.72-13a2.07 2.07 0 1 1 2.08-2.07a2.07 2.07 0 0 1-2.08 2.07m15.02 12.96h-3.51v-5.86c0-1.4 0-3.2-1.95-3.2s-2.25 1.52-2.25 3.1v5.96h-3.52V13h3.38v1.56a3.7 3.7 0 0 1 3.34-1.83c3.57 0 4.23 2.35 4.23 5.41v6.27z" />
  </svg>
);

const TwitterIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 32 32"
    fill="currentColor"
    className={className}
  >
    <path d="M11.92 24.94A12.76 12.76 0 0 0 25 11.18v-.59a9.4 9.4 0 0 0 2.25-2.32a9 9 0 0 1-2.59.71a4.56 4.56 0 0 0 2-2.5a8.98 8.98 0 0 1-2.87 1.1a4.52 4.52 0 0 0-7.7 4.11a12.84 12.84 0 0 1-9.3-4.72a4.51 4.51 0 0 0 1.4 6a4.47 4.47 0 0 1-2-.56a4.52 4.52 0 0 0 3.62 4.45a4.53 4.53 0 0 1-2 .08A4.51 4.51 0 0 0 12 20.14a9.05 9.05 0 0 1-5.61 1.94A9.77 9.77 0 0 1 5.32 22a12.77 12.77 0 0 0 6.6 2.94" />
  </svg>
);

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
