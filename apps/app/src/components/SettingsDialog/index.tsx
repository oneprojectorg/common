'use client';

import { trpc } from '@op/api/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@op/sense/Dialog';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from '@op/sense/Sidebar';
import { Skeleton } from '@op/sense/Skeleton';
import { Suspense } from 'react';

import { useTranslations } from '@/lib/i18n';

import ErrorBoundary from '../ErrorBoundary';
import {
  NOTIFICATION_CATEGORIES,
  type NotificationCategory,
  type NotificationChannel,
  type NotificationPreferences,
  NotificationPreferencesForm,
} from './NotificationPreferencesForm';

export interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const SettingsDialog = ({ open, onOpenChange }: SettingsDialogProps) => {
  const t = useTranslations('settings');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>
        <SidebarProvider className="min-h-0 flex-1 flex-col sm:flex-row">
          <Sidebar collapsible="none" className="w-full sm:w-55">
            <SidebarContent>
              <SidebarGroup>
                <SidebarGroupContent>
                  <SidebarMenu>
                    <SidebarMenuItem>
                      <SidebarMenuButton isActive aria-current="true">
                        {t('notificationsNav')}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>
          </Sidebar>
          <section className="flex min-w-0 flex-1 flex-col gap-4 p-8">
            <h2 className="font-serif text-title font-normal">
              {t('notificationsHeading')}
            </h2>
            <ErrorBoundary>
              <Suspense fallback={<NotificationPreferencesSkeleton />}>
                <NotificationPreferencesPane />
              </Suspense>
            </ErrorBoundary>
          </section>
        </SidebarProvider>
      </DialogContent>
    </Dialog>
  );
};

type ChannelPatch = Partial<Record<NotificationChannel, boolean>>;
type PreferencesPatch = Partial<Record<NotificationCategory, ChannelPatch>>;

const applyPatch = (
  prev: NotificationPreferences,
  patch: PreferencesPatch,
): NotificationPreferences => ({
  proposalsAndComments: {
    ...prev.proposalsAndComments,
    ...patch.proposalsAndComments,
  },
  thingsYouFollow: { ...prev.thingsYouFollow, ...patch.thingsYouFollow },
  processUpdates: { ...prev.processUpdates, ...patch.processUpdates },
  relationshipRequests: {
    ...prev.relationshipRequests,
    ...patch.relationshipRequests,
  },
});

const NotificationPreferencesPane = () => {
  const t = useTranslations('settings');
  const utils = trpc.useUtils();
  const [preferences] =
    trpc.account.getNotificationPreferences.useSuspenseQuery();

  const update = trpc.account.updateNotificationPreferences.useMutation({
    onMutate: async (patch) => {
      await utils.account.getNotificationPreferences.cancel();
      utils.account.getNotificationPreferences.setData(undefined, (prev) =>
        prev ? applyPatch(prev, patch) : prev,
      );
    },
    onSuccess: (saved) => {
      utils.account.getNotificationPreferences.setData(undefined, saved);
    },
    onError: () => {
      void utils.account.getNotificationPreferences.invalidate();
    },
  });

  const status = update.isPending
    ? t('savingStatus')
    : update.isError
      ? t('saveErrorStatus')
      : update.isSuccess
        ? t('savedStatus')
        : null;

  return (
    <>
      <NotificationPreferencesForm
        preferences={preferences}
        onChange={(category, channel, enabled) =>
          update.mutate({ [category]: { [channel]: enabled } })
        }
      />
      <p aria-live="polite" className="text-sm text-muted-foreground">
        {status}
      </p>
    </>
  );
};

const NotificationPreferencesSkeleton = () => (
  <div className="flex flex-col gap-8">
    {NOTIFICATION_CATEGORIES.map((category) => (
      <div key={category} className="flex flex-col gap-3">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-4 w-72" />
        <Skeleton className="h-6 w-40" />
      </div>
    ))}
  </div>
);
