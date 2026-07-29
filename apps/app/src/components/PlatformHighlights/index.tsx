'use client';

import { getPublicUrl } from '@/utils';
import { trpc } from '@op/api/client';
import { Avatar, AvatarFallback } from '@op/sense/Avatar';
import { Card } from '@op/sense/Card';
import { FacePile } from '@op/sense/FacePile';
import { ProfileAvatar } from '@op/sense/ProfileAvatar';
import { cn } from '@op/sense/lib/utils';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { ReactNode, Suspense, useEffect, useRef, useState } from 'react';

import { Link } from '@/lib/i18n';

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
            <hr className="hidden h-20 w-0.5 border-0 bg-neutral-gray1 sm:block" />
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
        <hr className="hidden h-20 w-0.5 border-0 bg-neutral-gray1 sm:block" />
        <Highlight>
          <HighlightNumber className="bg-redTeal">
            {stats.totalOrganizations}
          </HighlightNumber>
          <HighlightLabel>{t('organizations on Common')}</HighlightLabel>
        </Highlight>
        <hr className="hidden h-20 w-0.5 border-0 bg-neutral-gray1 sm:block" />
        <Highlight>
          <HighlightNumber className="bg-redPurple">
            {stats.totalUsers}
          </HighlightNumber>
          <HighlightLabel>{t('people on Common')}</HighlightLabel>
        </Highlight>
      </div>
      <div className="flex flex-col justify-center gap-2 border-0 border-t bg-neutral-offWhite p-6 text-sm text-neutral-charcoal sm:flex-row sm:items-center">
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
          'flex items-center justify-end bg-gradient bg-clip-text text-end font-serif text-title-xxl',
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
    <div className="col-span-2 flex h-12 max-w-32 items-center text-neutral-charcoal xxs:col-span-3">
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
  const facePileRef = useRef<HTMLDivElement>(null);
  const [numItems, setNumItems] = useState(20);

  useEffect(() => {
    if (!facePileRef.current) {
      return;
    }

    const resizeObserver = new ResizeObserver((e) => {
      // divide by 2 rem - 0.5 rem overlap
      setNumItems(
        Math.min(Math.floor((e[0]?.contentRect.width ?? 1) / (32 - 8)), 20),
      );
    });

    resizeObserver.observe(facePileRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [facePileRef]);

  const items = organizations
    .map((org) => {
      const { avatarImage } = org.profile;
      const avatarUrl = getPublicUrl(avatarImage?.name);
      return (
        <Link
          key={org.id}
          href={`/org/${org.profile.slug}`}
          className="hover:no-underline"
        >
          <ProfileAvatar
            name={org.profile.name}
            src={avatarUrl}
            alt={org.profile.name}
            imageRender={
              avatarUrl ? (
                <Image
                  src={avatarUrl}
                  alt={org.profile.name}
                  width={32}
                  height={32}
                />
              ) : undefined
            }
          />
          <div className="absolute start-0 top-0 h-full w-full cursor-pointer rounded-full bg-white opacity-0 transition-opacity duration-100 ease-in-out hover:opacity-15 active:bg-black" />
        </Link>
      );
    })
    .slice(0, numItems);

  if (stats.totalOrganizations > numItems) {
    items.push(
      <Link key="more" href="/org" className="hover:no-underline">
        <Avatar>
          <AvatarFallback className="bg-neutral-charcoal text-sm text-neutral-offWhite">
            <span className="align-super">+</span>
            {stats.totalOrganizations - numItems}
          </AvatarFallback>
        </Avatar>
      </Link>,
    );
  }

  return (
    <FacePile items={items} ref={facePileRef}>
      {children}
    </FacePile>
  );
};
