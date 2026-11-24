'use client';

import { trpc } from '@op/api/client';
import type { NotificationEncoded } from '@op/api/encoders';
import { useRelativeTime } from '@op/hooks';
import { Button } from '@op/sense/Button';
import { Popover, PopoverContent, PopoverTrigger } from '@op/sense/Popover';
import { Skeleton } from '@op/sense/Skeleton';
import { Suspense, useState } from 'react';
import { LuBell } from 'react-icons/lu';
import { z } from 'zod';

import { Link, useTranslations } from '@/lib/i18n';

import ErrorBoundary from '../ErrorBoundary';

const proposalCommentSnapshotSchema = z.object({
  commenterName: z.string(),
  proposalTitle: z.string(),
  decisionSlug: z.string().nullable(),
  proposalProfileId: z.string(),
  commentExcerpt: z.string(),
});

export const NotificationsMenu = () => {
  const t = useTranslations('notifications');
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="icon"
            aria-label={t('openLabel')}
            className="relative"
          />
        }
      >
        <LuBell className="size-4 text-muted-foreground" />
        <ErrorBoundary fallback={null}>
          <Suspense fallback={null}>
            <UnreadBadge />
          </Suspense>
        </ErrorBoundary>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <ErrorBoundary
          fallback={
            <p className="px-4 py-6 text-center text-muted-foreground">
              {t('loadError')}
            </p>
          }
        >
          <Suspense fallback={<NotificationListSkeleton />}>
            <NotificationList onNavigate={() => setIsOpen(false)} />
          </Suspense>
        </ErrorBoundary>
      </PopoverContent>
    </Popover>
  );
};

const UnreadBadge = () => {
  const t = useTranslations('notifications');
  const [{ count }] = trpc.notifications.unreadCount.useSuspenseQuery();

  return (
    <span aria-live="polite">
      {count > 0 && (
        <span className="absolute -end-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-label text-primary-foreground">
          <span aria-hidden>{count > 9 ? '9+' : count}</span>
          <span className="sr-only">{t('unreadCountLabel', { count })}</span>
        </span>
      )}
    </span>
  );
};

const NotificationList = ({ onNavigate }: { onNavigate: () => void }) => {
  const t = useTranslations('notifications');
  const utils = trpc.useUtils();
  const [{ items }] = trpc.notifications.list.useSuspenseQuery({ limit: 10 });

  const markRead = trpc.notifications.markRead.useMutation({
    onSuccess: () => utils.notifications.invalidate(),
  });
  const markAllRead = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => utils.notifications.invalidate(),
  });

  const hasUnread = items.some((notification) => !notification.readAt);

  return (
    <div className="flex w-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2">
        <h2 className="text-title">{t('panelTitle')}</h2>
        {hasUnread && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => markAllRead.mutate()}
            loading={markAllRead.isPending}
          >
            {t('markAllReadAction')}
          </Button>
        )}
      </div>
      {items.length === 0 ? (
        <p className="px-4 py-6 text-center text-muted-foreground">
          {t('emptyState')}
        </p>
      ) : (
        <ul className="flex max-h-96 flex-col overflow-y-auto">
          {items.map((notification) => (
            <NotificationRow
              key={notification.id}
              notification={notification}
              onOpen={() => {
                if (!notification.readAt) {
                  markRead.mutate({ ids: [notification.id] });
                }
                onNavigate();
              }}
            />
          ))}
        </ul>
      )}
    </div>
  );
};

const NotificationRow = ({
  notification,
  onOpen,
}: {
  notification: NotificationEncoded;
  onOpen: () => void;
}) => {
  const t = useTranslations('notifications');
  const timestamp = notification.createdAt ?? notification.activity.createdAt;
  const relativeTime = useRelativeTime(timestamp ?? new Date());
  const snapshot = proposalCommentSnapshotSchema.safeParse(
    notification.activity.snapshot,
  );

  if (!snapshot.success) {
    return null;
  }

  const { commenterName, proposalTitle, commentExcerpt, decisionSlug, proposalProfileId } =
    snapshot.data;

  const content = (
    <>
      <span
        aria-hidden
        className={
          notification.readAt
            ? 'mt-2 size-2 flex-none rounded-full bg-transparent'
            : 'mt-2 size-2 flex-none rounded-full bg-primary'
        }
      />
      <span className="flex min-w-0 flex-col gap-1">
        <span className="text-label">
          {t.rich('proposalCommentSummary', {
            commenterName,
            proposalTitle,
            name: (chunks) => <bdi className="font-medium">{chunks}</bdi>,
            title: (chunks) => <bdi className="font-medium">{chunks}</bdi>,
          })}
        </span>
        <span
          dir="auto"
          className="line-clamp-2 text-label text-muted-foreground ltr:text-left rtl:text-right"
        >
          {commentExcerpt}
        </span>
        <span className="text-label text-muted-foreground">{relativeTime}</span>
      </span>
    </>
  );

  if (!decisionSlug) {
    return (
      <li className="flex gap-3 border-b border-border px-4 py-3 last:border-b-0">
        {content}
      </li>
    );
  }

  return (
    <li className="border-b border-border last:border-b-0">
      <Link
        href={`/decisions/${decisionSlug}/proposal/${proposalProfileId}`}
        onClick={onOpen}
        className="flex gap-3 px-4 py-3 hover:bg-accent focus-visible:bg-accent"
      >
        {content}
      </Link>
    </li>
  );
};

const NotificationListSkeleton = () => (
  <div className="flex flex-col gap-3 px-4 py-3">
    <Skeleton className="h-5 w-32" />
    <Skeleton className="h-10 w-full" />
    <Skeleton className="h-10 w-full" />
  </div>
);
