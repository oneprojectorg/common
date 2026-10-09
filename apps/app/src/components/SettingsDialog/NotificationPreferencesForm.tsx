'use client';

import {
  Field,
  FieldDescription,
  FieldLegend,
  FieldSet,
} from '@op/sense/Field';
import { Label } from '@op/sense/Label';
import { Separator } from '@op/sense/Separator';
import { Switch } from '@op/sense/Switch';
import { Fragment, useId } from 'react';

import { useTranslations } from '@/lib/i18n';

export const NOTIFICATION_CATEGORIES = [
  'proposalsAndComments',
  'thingsYouFollow',
  'processUpdates',
  'relationshipRequests',
] as const;

export const NOTIFICATION_CHANNELS = ['email', 'sms'] as const;

export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];
export type NotificationPreferences = Record<
  NotificationCategory,
  Record<NotificationChannel, boolean>
>;

export interface NotificationPreferencesFormProps {
  preferences: NotificationPreferences;
  onChange: (
    category: NotificationCategory,
    channel: NotificationChannel,
    enabled: boolean,
  ) => void;
  disabled?: boolean;
}

export const NotificationPreferencesForm = ({
  preferences,
  onChange,
  disabled = false,
}: NotificationPreferencesFormProps) => {
  const t = useTranslations('settings');
  const tShared = useTranslations();
  const idPrefix = useId();

  const channelLabels: Record<NotificationChannel, string> = {
    email: tShared('Email'),
    sms: tShared('SMS'),
  };

  return (
    <div className="flex flex-col gap-8">
      {NOTIFICATION_CATEGORIES.map((category, index) => (
        <Fragment key={category}>
          {index > 0 ? <Separator /> : null}
          <FieldSet className="gap-3">
            <FieldLegend variant="label" className="mb-0">
              {t(`${category}Label`)}
            </FieldLegend>
            <FieldDescription>{t(`${category}Description`)}</FieldDescription>
            <div className="flex flex-wrap gap-8">
              {NOTIFICATION_CHANNELS.map((channel) => {
                const id = `${idPrefix}-${category}-${channel}`;
                return (
                  <Field
                    key={channel}
                    orientation="horizontal"
                    className="w-auto gap-5"
                  >
                    <Label htmlFor={id}>{channelLabels[channel]}</Label>
                    <Switch
                      id={id}
                      checked={preferences[category][channel]}
                      disabled={disabled}
                      onCheckedChange={(checked) =>
                        onChange(category, channel, checked)
                      }
                    />
                  </Field>
                );
              })}
            </div>
          </FieldSet>
        </Fragment>
      ))}
    </div>
  );
};
