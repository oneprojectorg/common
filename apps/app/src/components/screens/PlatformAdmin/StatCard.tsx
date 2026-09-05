'use client';

import { Card } from '@op/sense/Card';
import { cn } from '@op/sense/lib/utils';

import { Link, usePathname } from '@/lib/i18n';

/**
 * Individual stat card displaying label and numeric value. Client-side only
 * because of the active-route ring, which needs the current pathname.
 */
export const StatCard = ({
  label,
  value,
  href,
}: {
  label: string;
  value: number;
  href?: string;
}) => {
  const pathname = usePathname();
  const isActive = href ? pathname.startsWith(href) : false;

  const content = (
    <Card
      className={cn('p-8', isActive && 'border-primary ring-1 ring-primary')}
    >
      <div className="flex flex-col gap-2">
        <div className="text-muted-foreground">{label}</div>
        <div className="font-serif text-display font-light">{value}</div>
      </div>
    </Card>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="no-underline hover:no-underline hover:opacity-80"
      >
        {content}
      </Link>
    );
  }

  return content;
};
