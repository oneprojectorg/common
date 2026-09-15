'use client';

import { getPublicUrl } from '@/utils';
import { DATE_TIME_UTC_FORMAT } from '@/utils/formatting';
import type { RouterOutput } from '@op/api/client';
import { trpc } from '@op/api/client';
import { EntityType } from '@op/api/encoders';
import { useRelativeTime } from '@op/hooks';
import { Avatar, AvatarFallback, AvatarImage } from '@op/sense/Avatar';
import { Badge } from '@op/sense/Badge';
import { Button } from '@op/sense/Button';
import { Header1, Header2 } from '@op/sense/Header';
import { Skeleton } from '@op/sense/Skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@op/sense/Table';
import { useFormatter } from 'next-intl';
import { ErrorBoundary } from 'next/dist/client/components/error-boundary';
import { type ReactNode, Suspense, useState } from 'react';
import { LuArrowLeft } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';
import { Link } from '@/lib/i18n/routing';

import { ErrorMessage } from '@/components/ErrorMessage';

import { AddUserToOrgModal } from '../AddUserToOrgModal';
import { TimestampTooltip } from '../TimestampTooltip';
import { UpdateProfileModal } from '../UpdateProfile';

type AdminUser = RouterOutput['platform']['admin']['getUser'];
type OrganizationMembership = NonNullable<
  AdminUser['organizationUsers']
>[number];
type ProfileMembership = NonNullable<AdminUser['profileUsers']>[number];

/** Platform-admin drill-down for a single user account. */
export const UserDetail = ({ authUserId }: { authUserId: string }) => {
  return (
    <ErrorBoundary errorComponent={() => <UserDetailError />}>
      <Suspense fallback={<DetailSkeleton />}>
        <UserDetailContent authUserId={authUserId} />
      </Suspense>
    </ErrorBoundary>
  );
};

const UserDetailContent = ({ authUserId }: { authUserId: string }) => {
  const t = useTranslations();
  const utils = trpc.useUtils();
  const [user] = trpc.platform.admin.getUser.useSuspenseQuery({ authUserId });
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddToOrgModalOpen, setIsAddToOrgModalOpen] = useState(false);

  const displayName = user.profile?.name ?? user.name ?? t('Unknown user');
  const avatarUrl = user.avatarImage?.name
    ? (getPublicUrl(user.avatarImage.name) ?? undefined)
    : undefined;
  const organizationUsers = user.organizationUsers ?? [];
  const profileUsers = user.profileUsers ?? [];

  return (
    <div className="flex flex-col gap-6">
      <BackLink />
      <div className="flex flex-wrap items-center gap-4">
        <Avatar size="lg">
          {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
          <AvatarFallback name={displayName} />
        </Avatar>
        <div className="flex flex-col gap-1">
          <Header1 className="text-headline">{displayName}</Header1>
          <span className="text-label text-muted-foreground">
            {user.email ?? '—'}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {user.access?.platform?.admin ? (
            <Badge>{t('Platform admin')}</Badge>
          ) : null}
          {user.isAnonymous ? (
            <Badge variant="secondary">{t('Anonymous')}</Badge>
          ) : null}
          {user.isNetworkMember ? (
            <Badge variant="outline">{t('Network member')}</Badge>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2 sm:ms-auto">
          <Button
            variant="outline"
            disabled={!user.profile}
            onClick={() => setIsEditModalOpen(true)}
          >
            {t('Edit profile')}
          </Button>
          <Button
            variant="outline"
            onClick={() => setIsAddToOrgModalOpen(true)}
          >
            {t('Add to organization')}
          </Button>
        </div>
      </div>

      <dl className="flex flex-wrap gap-x-10 gap-y-3">
        <Fact label={t('Created')} value={user.createdAt} />
        <Fact label={t('Last sign in')} value={user.lastSignInAt} />
        <Fact label={t('Onboarded')} value={user.onboardedAt} />
        <Fact label={t('Terms accepted')} value={user.tosAcceptedOn} />
        <Fact label={t('Privacy accepted')} value={user.privacyAcceptedOn} />
      </dl>

      <section aria-live="polite" className="flex flex-col gap-6">
        <MembershipSection title={t('Organizations')}>
          {organizationUsers.length > 0 ? (
            <Table aria-label={t('Organizations')}>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('Organization')}</TableHead>
                  <TableHead>{t('Roles')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {organizationUsers.map((membership) => (
                  <TableRow key={membership.id}>
                    <TableCell>
                      <OrganizationName membership={membership} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {roleNames(membership.roles) ?? t('No roles')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState text={t('Not a member of any organization')} />
          )}
        </MembershipSection>

        <MembershipSection title={t('Profile memberships')}>
          {profileUsers.length > 0 ? (
            <Table aria-label={t('Profile memberships')}>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('Profile')}</TableHead>
                  <TableHead>{t('Roles')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profileUsers.map((membership) => (
                  <TableRow key={membership.id}>
                    <TableCell>
                      <ProfileName membership={membership} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {roleNames(membership.roles) ?? t('No roles')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState text={t('No profile memberships')} />
          )}
        </MembershipSection>
      </section>

      {user.profile ? (
        <UpdateProfileModal
          authUserId={user.authUserId}
          profile={user.profile}
          isOpen={isEditModalOpen}
          onOpenChange={setIsEditModalOpen}
          onSuccess={() => {
            utils.platform.admin.getUser.invalidate({ authUserId });
            utils.platform.admin.listAllUsers.invalidate();
          }}
        />
      ) : null}
      <AddUserToOrgModal
        user={user}
        isOpen={isAddToOrgModalOpen}
        onOpenChange={setIsAddToOrgModalOpen}
      />
    </div>
  );
};

const roleNames = (roles: OrganizationMembership['roles']) => {
  if (!roles || roles.length === 0) {
    return null;
  }

  return roles.map((roleJunction) => roleJunction.accessRole.name).join(', ');
};

const BackLink = () => {
  const t = useTranslations();

  return (
    <Link
      href="/admin/users"
      className="flex w-fit items-center gap-1.5 text-label text-muted-foreground hover:text-foreground"
    >
      <LuArrowLeft className="size-3.5 rtl:-scale-x-100" />
      {t('platformAdmin_allUsers')}
    </Link>
  );
};

const Fact = ({
  label,
  value,
}: {
  label: string;
  /** Timestamp, or null when the event never happened. */
  value: string | Date | null | undefined;
}) => {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-label tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="text-label">
        {value ? <RelativeTimestamp value={value} /> : '—'}
      </dd>
    </div>
  );
};

const RelativeTimestamp = ({ value }: { value: string | Date }) => {
  const format = useFormatter();
  const date = new Date(value);
  const relative = useRelativeTime(date);

  return (
    <TimestampTooltip
      className="font-normal"
      title={format.dateTime(date, DATE_TIME_UTC_FORMAT)}
    >
      {relative}
    </TimestampTooltip>
  );
};

const MembershipSection = ({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) => {
  return (
    <div className="flex flex-col gap-3">
      <Header2 className="text-title">{title}</Header2>
      {children}
    </div>
  );
};

const OrganizationName = ({
  membership,
}: {
  membership: OrganizationMembership;
}) => {
  const t = useTranslations();
  const profile = membership.organization?.profile;

  if (!profile) {
    return <>{t('Unknown Organization')}</>;
  }

  return (
    <Link href={`/org/${profile.slug}`} className="hover:underline">
      {profile.name}
    </Link>
  );
};

const ProfileName = ({ membership }: { membership: ProfileMembership }) => {
  const t = useTranslations();
  const profile = membership.profile;

  if (!profile) {
    return <>{membership.name ?? t('Unknown user')}</>;
  }

  const href =
    profile.type === EntityType.INDIVIDUAL
      ? `/profile/${profile.slug}`
      : `/org/${profile.slug}`;

  return (
    <Link href={href} className="hover:underline">
      {profile.name}
    </Link>
  );
};

const EmptyState = ({ text }: { text: string }) => {
  return (
    <p className="rounded-md border border-dashed px-3 py-2 text-label text-muted-foreground">
      {text}
    </p>
  );
};

const UserDetailError = () => {
  const t = useTranslations();

  return (
    <div className="flex flex-col gap-6">
      <BackLink />
      <ErrorMessage>{t('User not found')}</ErrorMessage>
    </div>
  );
};

const DetailSkeleton = () => {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-5 w-32" />
      <Skeleton className="h-16 w-96" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
};
