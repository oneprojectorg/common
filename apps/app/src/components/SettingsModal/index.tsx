'use client';

import { useRequiredUser } from '@/utils/UserProvider';
import { useMediaQuery } from '@op/hooks';
import { Button } from '@op/sense/Button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@op/sense/Dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@op/sense/Tabs';
import { cn } from '@op/sense/lib/utils';
import { screens } from '@op/styles/constants';
import { useRef, useState } from 'react';
import { LuX } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { AccountSettings } from './AccountSettings';
import { NotificationSettings } from './NotificationSettings';
import { PrivacySettings } from './PrivacySettings';
import { YourDataSettings } from './YourDataSettings';
import { useSettingsMockState } from './useSettingsMockState';

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type SettingsSection = 'account' | 'privacy' | 'notifications' | 'data';

/**
 * The user's Settings, opened from the avatar menu: Account, Privacy,
 * Notifications and Your data. A sidebar of sections beside the open one on
 * wider screens; below `sm` the sidebar becomes a tab strip above it.
 *
 * UI only for now. Changes live in local state (see `useSettingsMockState`)
 * and are lost on reload, except the language, which is real.
 */
export const SettingsModal = ({ open, onOpenChange }: SettingsModalProps) => {
  const t = useTranslations('settings');
  const tShared = useTranslations();
  const { user } = useRequiredUser();
  // Arrow keys follow the layout: up/down in the sidebar, left/right in the
  // strip.
  const isSidebarLayout = useMediaQuery(`(min-width: ${screens.sm})`);
  const [section, setSection] = useState<SettingsSection>('account');
  const settings = useSettingsMockState(user.email ?? null);
  const accountTabRef = useRef<HTMLButtonElement>(null);

  const goToAccount = () => {
    setSection('account');
    accountTabRef.current?.focus();
  };

  const sections: Array<{ value: SettingsSection; label: string }> = [
    { value: 'account', label: t('accountTab') },
    { value: 'privacy', label: t('privacyTab') },
    { value: 'notifications', label: t('notificationsTab') },
    { value: 'data', label: t('yourDataTab') },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Our own close button: the built-in one's label isn't translated. */}
      <DialogContent
        showCloseButton={false}
        // 800px wide, shrinking to keep the dialog margin on 640-832px
        // screens; the base classes centre it.
        className={cn(
          'overflow-hidden sm:h-160 sm:w-200 sm:max-w-dialog',
          // Base UI draws no backdrop for a dialog opened from inside this one
          // (Delete account), so dim this one while it's open.
          'data-nested-dialog-open:after:absolute data-nested-dialog-open:after:inset-0 data-nested-dialog-open:after:z-30 data-nested-dialog-open:after:bg-overlay/15',
        )}
      >
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          {/* 14/20 in the Figma frame; Sense's default is 16/24. */}
          <DialogDescription className="text-sm">
            {t('description')}
          </DialogDescription>
        </DialogHeader>
        <DialogClose
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={tShared('Close')}
              className="absolute end-4 top-4 z-20 opacity-70 hover:bg-transparent hover:opacity-100"
            />
          }
        >
          <LuX />
        </DialogClose>

        <Tabs
          value={section}
          onValueChange={(value) => {
            const next = sections.find((item) => item.value === value);
            if (next) {
              setSection(next.value);
            }
          }}
          orientation={isSidebarLayout ? 'vertical' : 'horizontal'}
          className="min-h-0 flex-1 gap-0 sm:flex-row"
        >
          <TabsList
            aria-label={t('sectionsLabel')}
            className="mx-4 mt-4 flex h-auto w-auto shrink-0 justify-start gap-1 overflow-x-auto rounded-md bg-sidebar p-1 group-data-horizontal/tabs:h-auto group-data-vertical/tabs:h-auto sm:m-0 sm:w-55 sm:items-stretch sm:overflow-x-visible sm:rounded-none sm:p-2"
          >
            {sections.map(({ value, label }) => (
              <TabsTrigger
                key={value}
                ref={value === 'account' ? accountTabRef : undefined}
                value={value}
                className="h-10 flex-none justify-start rounded-md border-0 px-2 font-normal text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-active:bg-sidebar-accent data-active:text-sidebar-accent-foreground group-data-[variant=default]/tabs-list:data-active:shadow-none"
              >
                {label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="account" className={PANEL_CLASS_NAME}>
            <AccountSettings
              email={settings.email}
              phone={settings.phone}
              twoStepEnabled={settings.twoStepEnabled}
              setChannel={settings.setChannel}
              removeChannel={settings.removeChannel}
              setTwoStepEnabled={settings.setTwoStepEnabled}
            />
          </TabsContent>
          <TabsContent value="privacy" className={PANEL_CLASS_NAME}>
            <PrivacySettings
              processes={settings.processes}
              userName={user.currentProfile?.name ?? user.name ?? ''}
              setParticipationMode={settings.setParticipationMode}
            />
          </TabsContent>
          <TabsContent value="notifications" className={PANEL_CLASS_NAME}>
            <NotificationSettings
              email={settings.email}
              phone={settings.phone}
              notifications={settings.notifications}
              setNotification={settings.setNotification}
              onGoToAccount={goToAccount}
            />
          </TabsContent>
          <TabsContent value="data" className={PANEL_CLASS_NAME}>
            <YourDataSettings />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

// The panel is a focus stop (Base UI makes it one, and it scrolls), so it
// needs a visible ring; inset so the dialog's overflow can't clip it.
const PANEL_CLASS_NAME =
  'min-w-0 overflow-y-auto px-4 pt-6 pb-8 focus-visible:inset-ring-3 focus-visible:inset-ring-ring/50 sm:p-8';
