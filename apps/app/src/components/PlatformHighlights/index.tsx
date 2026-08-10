'use client';

import { getPublicUrl } from '@/utils';
import { trpc } from '@op/api/client';
import { Avatar, AvatarFallback } from '@op/sense/Avatar';
import { Card } from '@op/sense/Card';
import { GrowingFacePile } from '@op/sense/FacePile';
import { cn } from '@op/sense/lib/utils';
import { useTranslations } from 'next-intl';
import { ReactNode, Suspense } from 'react';

import { Link } from '@/lib/i18n';

import {
  AvatarLinkHoverTint,
  ProfileAvatarLink,
  avatarLinkClassName,
} from '../ProfileAvatarLink';

export const PlatformHighlights = () => {
  const [stats] = trpc.platform.getStats.useSuspenseQuery();
  const t = useTranslations();

  return (
    <Card className="gap-0 py-0">
      <div className="flex flex-col items-center justify-between gap-6 px-10 py-6 sm:flex-row sm:gap-4">
        {stats.newOrganizations > 0 && (
          <>
            <Highlight>
              <HighlightNumber className="bg-tealGreen">
                {stats.newOrganizations}
              </HighlightNumber>
              <HighlightLabel>
                {t('new organizations to explore')}
              </HighlightLabel>
            </Highlight>
            <hr className="hidden h-20 w-0.5 border-0 bg-secondary sm:block" />
          </>
        )}
        <Highlight>
          <HighlightNumber className="bg-orange">
            {stats.totalRelationships}
          </HighlightNumber>
          <HighlightLabel>
            {t(
              '{count, plural, =1 {active relationship} other {active relationships}}',
              { count: stats.totalRelationships },
            )}
          </HighlightLabel>
        </Highlight>
        <hr className="hidden h-20 w-0.5 border-0 bg-secondary sm:block" />
        <Highlight>
          <HighlightNumber className="bg-redTeal">
            {stats.totalOrganizations}
          </HighlightNumber>
          <HighlightLabel>{t('organizations on Common')}</HighlightLabel>
        </Highlight>
        <hr className="hidden h-20 w-0.5 border-0 bg-secondary sm:block" />
        <Highlight>
          <HighlightNumber className="bg-redPurple">
            {stats.totalUsers}
          </HighlightNumber>
          <HighlightLabel>{t('people on Common')}</HighlightLabel>
        </Highlight>
      </div>
      <div className="flex flex-col justify-center gap-2 border-0 border-t bg-muted p-6 text-sm sm:flex-row sm:items-center">
        <Suspense>
          <div className="flex max-w-full items-center gap-2">
            <OrganizationFacePile>
              <span className="whitespace-nowrap">
                {t('are collaborating on Common')}
              </span>
            </OrganizationFacePile>
          </div>
        </Suspense>
      </div>
    </Card>
  );
};

const HighlightNumber = ({
  children,
  className,
}: {
  children?: ReactNode;
  className?: string;
}) => {
  return (
    <div className="col-span-3 text-transparent xxs:col-span-2">
      <div
        className={cn(
          'flex items-center justify-end bg-gradient bg-clip-text text-end font-serif text-display font-light',
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
};

const HighlightLabel = ({ children }: { children?: ReactNode }) => {
  return (
    <div className="col-span-2 flex h-12 max-w-32 items-center xxs:col-span-3">
      {children}
    </div>
  );
};

const Highlight = ({ children }: { children?: ReactNode }) => {
  return (
    <div className="grid w-full grid-cols-5 items-center gap-4 xxs:flex sm:flex">
      {children}
    </div>
  );
};

const OrganizationFacePile = ({ children }: { children?: ReactNode }) => {
  const [[{ items: organizations }, stats]] = trpc.useSuspenseQueries((t) => [
    t.organization.list({ limit: 100 }),
    t.platform.getStats(),
  ]);

  const items = organizations.map((org) => (
    <ProfileAvatarLink
      key={org.id}
      href={`/org/${org.profile.slug}`}
      name={org.profile.name}
      src={getPublicUrl(org.profile.avatarImage?.name)}
      alt={org.profile.name}
    />
  ));

  return (
    <GrowingFacePile
      items={items}
      totalCount={stats.totalOrganizations}
      renderOverflow={(count) => (
        <Link href="/org" className={avatarLinkClassName}>
          <Avatar>
            <AvatarFallback className="bg-foreground text-sm text-background">
              <span className="align-super">+</span>
              {count}
            </AvatarFallback>
          </Avatar>
          <AvatarLinkHoverTint />
        </Link>
      )}
    >
      {children}
    </GrowingFacePile>
  );
};
