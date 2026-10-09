'use client';

import { Button } from '@op/sense/Button';
import {
  Field,
  FieldDescription,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@op/sense/Field';
import { Header3 } from '@op/sense/Header';
import { Switch } from '@op/sense/Switch';
import { type ReactNode, useId } from 'react';

import { useTranslations } from '@/lib/i18n';

import type {
  NotificationChannels,
  NotificationPreferences,
  NotificationTopic,
} from './useSettingsMockState';

interface NotificationSettingsProps {
  email: string | null;
  phone: string | null;
  notifications: NotificationPreferences;
  setNotification: (
    topic: NotificationTopic,
    channel: keyof NotificationChannels,
    enabled: boolean,
  ) => void;
  /** Opens the Account tab, where a missing channel can be added. */
  onGoToAccount: () => void;
}

const TOPICS: Array<NotificationTopic> = [
  'replies',
  'follows',
  'processUpdates',
  'relationshipRequests',
];

/**
 * The Notifications tab: one row per topic, each with a switch for every
 * channel on file. A channel that isn't on file gets a note pointing to
 * Account instead of a switch.
 */
export const NotificationSettings = ({
  email,
  phone,
  notifications,
  setNotification,
  onGoToAccount,
}: NotificationSettingsProps) => {
  const t = useTranslations('settings');

  const accountLink = (chunks: ReactNode) => (
    <Button
      variant="link"
      size="inline"
      className="text-sm"
      onClick={onGoToAccount}
    >
      {chunks}
    </Button>
  );

  return (
    <div className="flex flex-col gap-4">
      <Header3>{t('notificationsTab')}</Header3>
      <div className="flex flex-col divide-y">
        {TOPICS.map((topic) => (
          <NotificationRow
            key={topic}
            topic={topic}
            channels={notifications[topic]}
            hasEmail={Boolean(email)}
            hasPhone={Boolean(phone)}
            onChange={(channel, enabled) =>
              setNotification(topic, channel, enabled)
            }
          />
        ))}
      </div>
      {phone ? null : (
        <p className="mt-2 text-sm text-muted-foreground">
          {t.rich('addPhoneForTexts', { link: accountLink })}
        </p>
      )}
      {email ? null : (
        <p className="mt-2 text-sm text-muted-foreground">
          {t.rich('addEmailForEmails', { link: accountLink })}
        </p>
      )}
    </div>
  );
};

const NotificationRow = ({
  topic,
  channels,
  hasEmail,
  hasPhone,
  onChange,
}: {
  topic: NotificationTopic;
  channels: NotificationChannels;
  hasEmail: boolean;
  hasPhone: boolean;
  onChange: (channel: keyof NotificationChannels, enabled: boolean) => void;
}) => {
  const t = useTranslations('settings');
  const tShared = useTranslations();
  const copy = useTopicCopy(topic);
  const descriptionId = useId();

  return (
    // The spacing sits on a wrapper: a fieldset's own padding goes between its
    // legend and the rest, not above the legend.
    <div className="py-8 first:pt-0 last:pb-0">
      {/* The legend names the group, so each switch only needs its channel. */}
      <FieldSet aria-describedby={descriptionId} className="min-w-0 gap-0">
        <FieldLegend variant="label" className="mb-0">
          {copy.title}
        </FieldLegend>
        {/* Sense pulls a second-to-last description up into its label;
            here the switches come after it. */}
        <FieldDescription id={descriptionId} className="nth-last-2:mt-0">
          {copy.hint}
        </FieldDescription>
        <div className="mt-5 flex flex-wrap gap-x-9 gap-y-3">
          {hasEmail ? (
            <ChannelSwitch
              label={tShared('Email')}
              checked={channels.email}
              onCheckedChange={(enabled) => onChange('email', enabled)}
            />
          ) : null}
          {hasPhone ? (
            <ChannelSwitch
              label={t('smsLabel')}
              checked={channels.sms}
              onCheckedChange={(enabled) => onChange('sms', enabled)}
            />
          ) : null}
        </div>
      </FieldSet>
    </div>
  );
};

const ChannelSwitch = ({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) => {
  const id = useId();

  return (
    <Field orientation="horizontal" className="w-auto gap-5">
      <FieldLabel htmlFor={id} className="font-normal">
        {label}
      </FieldLabel>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </Field>
  );
};

const useTopicCopy = (topic: NotificationTopic) => {
  const t = useTranslations('settings');

  switch (topic) {
    case 'replies':
      return { title: t('repliesTitle'), hint: t('repliesHint') };
    case 'follows':
      return { title: t('followsTitle'), hint: t('followsHint') };
    case 'processUpdates':
      return {
        title: t('processUpdatesTitle'),
        hint: t('processUpdatesHint'),
      };
    case 'relationshipRequests':
      return {
        title: t('relationshipRequestsTitle'),
        hint: t('relationshipRequestsHint'),
      };
  }
};
