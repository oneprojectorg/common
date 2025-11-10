'use client';

import { getPublicUrl } from '@/utils';
import { pluralize } from '@/utils/pluralize';
import { trpc } from '@op/api/client';
import { Avatar } from '@op/ui/Avatar';
import { FacePile } from '@op/ui/FacePile';
import { Surface } from '@op/ui/Surface';
import { cn } from '@op/ui/utils';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { ReactNode, Suspense, useEffect, useRef, useState } from 'react';

import { Link } from '@/lib/i18n';

const hello = () => {};

export const PlatformHighlights = () => {
  const [stats] = trpc.platform.getStats.useSuspenseQuery();
  const t = useTranslations();

  return (
    <Surface className="shadow-light">
      <div className="flex flex-col items-center justify-between gap-6 px-10 py-6 sm:flex-row sm:gap-4">
        <Highlight>
          <HighlightNumber className="bg-tealGreen">
            {stats.newOrganizations}
          </HighlightNumber>
          <HighlightLabel>{t('new organizations to explore')}</HighlightLabel>
        </Highlight>
        <hr className="hidden h-20 w-0.5 bg-neutral-gray1 sm:block" />
        <Highlight>
          <HighlightNumber className="bg-orange">
            {stats.totalRelationships}
          </HighlightNumber>
          <HighlightLabel>
            {t('active')} {pluralize('relationship', stats.totalRelationships)}
          </HighlightLabel>
        </Highlight>
        <hr className="hidden h-20 w-0.5 bg-neutral-gray1 sm:block" />
        <Highlight>
          <HighlightNumber className="bg-redTeal">
            {stats.totalOrganizations}
          </HighlightNumber>
          <HighlightLabel>{t('organizations on Common')}</HighlightLabel>
        </Highlight>
        <hr className="hidden h-20 w-0.5 bg-neutral-gray1 sm:block" />
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
    </Surface>
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
          'flex items-center justify-end bg-gradient bg-clip-text text-right font-serif text-title-xxl',
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
  const [{ items: organizations }] = trpc.organization.list.useSuspenseQuery({
    limit: 100,
  });

  const [stats] = trpc.platform.getStats.useSuspenseQuery();
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
          <Avatar placeholder={org.profile.name}>
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt={org.profile.name}
                fill
                className="object-cover"
              />
            ) : null}
          </Avatar>
          <div className="absolute left-0 top-0 h-full w-full cursor-pointer rounded-full bg-white opacity-0 transition-opacity duration-100 ease-in-out active:bg-black hover:opacity-15" />
        </Link>
      );
    })
    .slice(0, numItems);

  if (stats.totalOrganizations > numItems) {
    items.push(
      <Link key="more" href="/org" className="hover:no-underline">
        <Avatar className="bg-neutral-charcoal text-sm text-neutral-offWhite">
          <span className="align-super">+</span>
          {stats.totalOrganizations - numItems}
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

export default { hello };
