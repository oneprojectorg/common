'use client';

import { useState } from 'react';

import { type SignInChannel, otherChannel } from './signInChannels';

export interface AccountSettings {
  email: string | null;
  phone: string | null;
  twoStepEnabled: boolean;
}

export interface AccountSettingsActions {
  setChannel: (channel: SignInChannel, value: string) => void;
  removeChannel: (channel: SignInChannel) => void;
  setTwoStepEnabled: (enabled: boolean) => void;
}

export type NotificationTopic =
  | 'replies'
  | 'follows'
  | 'processUpdates'
  | 'relationshipRequests';

export interface NotificationChannels {
  email: boolean;
  sms: boolean;
}

export type NotificationPreferences = Record<
  NotificationTopic,
  NotificationChannels
>;

interface SettingsMockState extends AccountSettings {
  notifications: NotificationPreferences;
}

export interface SettingsMockActions extends AccountSettingsActions {
  setNotification: (
    topic: NotificationTopic,
    channel: keyof NotificationChannels,
    enabled: boolean,
  ) => void;
}

// TODO: replace with the settings API; nothing is saved and all but the email is a placeholder
const MOCK_PHONE = '+1-555-555-5555';

const MOCK_NOTIFICATIONS: NotificationPreferences = {
  replies: { email: true, sms: true },
  follows: { email: true, sms: false },
  processUpdates: { email: true, sms: false },
  relationshipRequests: { email: true, sms: false },
};

export const useSettingsMockState = (
  initialEmail: string | null,
): SettingsMockState & SettingsMockActions => {
  const [state, setState] = useState<SettingsMockState>(() => ({
    email: initialEmail,
    phone: MOCK_PHONE,
    twoStepEnabled: Boolean(initialEmail),
    notifications: MOCK_NOTIFICATIONS,
  }));

  const setChannel = (channel: SignInChannel, value: string) =>
    setState((prev) =>
      channel === 'email'
        ? { ...prev, email: value }
        : { ...prev, phone: value },
    );

  const removeChannel = (channel: SignInChannel) =>
    setState((prev) => {
      if (!prev[otherChannel(channel)]) {
        return prev;
      }

      const notificationChannel = channel === 'email' ? 'email' : 'sms';
      const notifications = mapTopics(prev.notifications, (channels) => ({
        ...channels,
        [notificationChannel]: false,
      }));

      return channel === 'email'
        ? { ...prev, email: null, twoStepEnabled: false, notifications }
        : { ...prev, phone: null, twoStepEnabled: false, notifications };
    });

  const setTwoStepEnabled = (enabled: boolean) =>
    setState((prev) => ({
      ...prev,
      twoStepEnabled: enabled && Boolean(prev.email && prev.phone),
    }));

  const setNotification = (
    topic: NotificationTopic,
    channel: keyof NotificationChannels,
    enabled: boolean,
  ) =>
    setState((prev) => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        [topic]: { ...prev.notifications[topic], [channel]: enabled },
      },
    }));

  return {
    ...state,
    setChannel,
    removeChannel,
    setTwoStepEnabled,
    setNotification,
  };
};

const mapTopics = (
  preferences: NotificationPreferences,
  update: (channels: NotificationChannels) => NotificationChannels,
): NotificationPreferences => ({
  replies: update(preferences.replies),
  follows: update(preferences.follows),
  processUpdates: update(preferences.processUpdates),
  relationshipRequests: update(preferences.relationshipRequests),
});
