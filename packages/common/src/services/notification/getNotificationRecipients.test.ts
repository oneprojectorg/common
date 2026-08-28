import { NotificationChannel } from '@op/db/schema';
import { describe, expect, it, vi } from 'vitest';

// Boundary mock: the module under test imports the db client at module scope,
// and that client imports `server-only`, which throws outside a server bundle.
// Only the pure mapping is exercised here, so the query builder is never used.
vi.mock('@op/db/client', () => ({
  db: { select: vi.fn() },
  and: vi.fn(),
  eq: vi.fn(),
}));

import {
  type NotificationRecipientRow,
  toNotificationRecipient,
} from './getNotificationRecipients';

const AUTH_USER_ID = '11111111-1111-4111-8111-111111111111';

/** A queried row, defaulting to a confirmed phone and an email preference. */
const row = (
  overrides: Partial<NotificationRecipientRow> = {},
): NotificationRecipientRow => ({
  authUserId: AUTH_USER_ID,
  email: 'ada@example.com',
  phone: '+15005550006',
  phoneConfirmedAt: new Date('2026-08-01T00:00:00Z'),
  channel: NotificationChannel.EMAIL,
  ...overrides,
});

describe('toNotificationRecipient', () => {
  describe('the phone number', () => {
    it('returns a confirmed number', () => {
      expect(toNotificationRecipient(row()).phone).toBe('+15005550006');
    });

    it('drops a number that Supabase has not confirmed', () => {
      // An unconfirmed number is not an address. Returning it would let a
      // caller text a number nobody proved they control.
      expect(
        toNotificationRecipient(row({ phoneConfirmedAt: null })).phone,
      ).toBeNull();
    });

    it('returns null when no number is recorded', () => {
      expect(toNotificationRecipient(row({ phone: null })).phone).toBeNull();
    });
  });

  describe('the resolved channel', () => {
    it('keeps SMS when a confirmed number backs it', () => {
      expect(
        toNotificationRecipient(row({ channel: NotificationChannel.SMS }))
          .channel,
      ).toBe(NotificationChannel.SMS);
    });

    it('falls back to email when SMS has no confirmed number', () => {
      // A person who picks SMS and then removes their number must still be
      // reachable. Honouring the preference here would drop the notification.
      expect(
        toNotificationRecipient(
          row({ channel: NotificationChannel.SMS, phone: null }),
        ).channel,
      ).toBe(NotificationChannel.EMAIL);
    });

    it('falls back to email when the number is unconfirmed', () => {
      expect(
        toNotificationRecipient(
          row({ channel: NotificationChannel.SMS, phoneConfirmedAt: null }),
        ).channel,
      ).toBe(NotificationChannel.EMAIL);
    });

    it('defaults to email when the account has no preference row', () => {
      // The `users` join is left, so a membership with no matching account
      // still resolves to a channel rather than to null.
      expect(toNotificationRecipient(row({ channel: null })).channel).toBe(
        NotificationChannel.EMAIL,
      );
    });

    it('never resolves to SMS without a number to send to', () => {
      const resolved = [
        row({ channel: NotificationChannel.SMS, phone: null }),
        row({ channel: NotificationChannel.SMS, phoneConfirmedAt: null }),
        row({ channel: null, phone: null }),
      ].map(toNotificationRecipient);

      expect(
        resolved.every(
          (r) => r.channel !== NotificationChannel.SMS || r.phone !== null,
        ),
      ).toBe(true);
    });
  });

  it('passes the membership email through untouched', () => {
    // Today's notification functions read profile_users.email. This reader
    // resolves the same address, so it changes nobody's recipient.
    expect(
      toNotificationRecipient(row({ email: 'grace@example.com' })).email,
    ).toBe('grace@example.com');
  });

  it('reports a participant with no address at all', () => {
    // Resolves to email with a null address. The caller skips the row; the
    // reader does not silently drop a participant it cannot explain.
    const recipient = toNotificationRecipient(
      row({ email: null, phone: null, channel: NotificationChannel.SMS }),
    );

    expect(recipient).toEqual({
      authUserId: AUTH_USER_ID,
      email: null,
      phone: null,
      channel: NotificationChannel.EMAIL,
    });
  });
});
