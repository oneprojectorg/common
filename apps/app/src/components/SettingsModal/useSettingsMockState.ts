'use client';

import { useState } from 'react';

import { type SignInChannel, otherChannel } from './signInChannels';

export interface AccountSettings {
  email: string | null;
  phone: string | null;
  /** Only meaningful while both channels are on file. */
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

/** Which channels deliver a notification topic. `sms` goes to the phone. */
export interface NotificationChannels {
  email: boolean;
  sms: boolean;
}

export type NotificationPreferences = Record<
  NotificationTopic,
  NotificationChannels
>;

export type ParticipationMode = 'name' | 'anonymous';

/** How the user appears in one decision process they joined. */
export interface ProcessPrivacy {
  id: string;
  processName: string;
  organizationName: string;
  /** Shown instead of the user's name while they stay anonymous. */
  participantNumber: string;
  mode: ParticipationMode;
}

interface SettingsMockState extends AccountSettings {
  notifications: NotificationPreferences;
  processes: Array<ProcessPrivacy>;
}

export interface SettingsMockActions extends AccountSettingsActions {
  setNotification: (
    topic: NotificationTopic,
    channel: keyof NotificationChannels,
    enabled: boolean,
  ) => void;
  setParticipationMode: (processId: string, mode: ParticipationMode) => void;
}

// TODO: replace with the settings API. The modal is UI-only for now: nothing
// here is saved, and everything but the email is a placeholder.
const MOCK_PHONE = '+1-555-555-5555';

const MOCK_NOTIFICATIONS: NotificationPreferences = {
  replies: { email: true, sms: true },
  follows: { email: true, sms: false },
  processUpdates: { email: true, sms: false },
  relationshipRequests: { email: true, sms: false },
};

const MOCK_PROCESSES: Array<ProcessPrivacy> = [
  {
    id: 'our-voice-our-choice',
    processName: 'Our Voice, Our Choice Budget',
    organizationName: 'City of Columbus',
    participantNumber: '483',
    mode: 'anonymous',
  },
  {
    id: 'ai-provider-input',
    processName: 'AI Provider Input Process',
    organizationName: 'One Project',
    participantNumber: '332',
    mode: 'anonymous',
  },
  {
    id: 'cowop-fund',
    processName: '2026 COWOP Fund for Co-ops',
    organizationName: 'COWOP',
    participantNumber: '118',
    mode: 'name',
  },
];

/**
 * Local state standing in for the settings API while the Settings modal is
 * built UI-first. Enforces the same rules the API will: the account keeps at
 * least one sign-in channel, two-step verification needs both, and removing a
 * channel turns off the notifications it delivered.
 */
export const useSettingsMockState = (
  initialEmail: string | null,
): SettingsMockState & SettingsMockActions => {
  const [state, setState] = useState<SettingsMockState>(() => ({
    email: initialEmail,
    phone: MOCK_PHONE,
    twoStepEnabled: Boolean(initialEmail),
    notifications: MOCK_NOTIFICATIONS,
    processes: MOCK_PROCESSES,
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

  const setParticipationMode = (processId: string, mode: ParticipationMode) =>
    setState((prev) => ({
      ...prev,
      processes: prev.processes.map((process) =>
        process.id === processId ? { ...process, mode } : process,
      ),
    }));

  return {
    ...state,
    setChannel,
    removeChannel,
    setTwoStepEnabled,
    setNotification,
    setParticipationMode,
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
