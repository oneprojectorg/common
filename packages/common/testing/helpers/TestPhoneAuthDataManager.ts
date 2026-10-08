import { db, eq } from '@op/db/client';
import { authUsers, profiles, users } from '@op/db/schema';

import {
  type PhoneNumber,
  toGoTruePhoneFormat,
} from '../../src/services/notification/schemas';
import { type TestAdminClient, createTestAdminClient } from './adminClient';

interface CreatePhoneUserOptions {
  /** The number, in E.164 form. */
  phone: PhoneNumber;
  /** Whether GoTrue should mark the number confirmed at creation. */
  confirmed?: boolean;
  /**
   * When GoTrue last sent a code, stamped onto `auth.users.confirmation_sent_at`.
   * Omit for a row that never entered a signup attempt.
   */
  codeSentAt?: Date;
}

/**
 * Test Phone Auth Data Manager
 *
 * Creates `auth.users` rows for phone-signup tests and removes them when the
 * test finishes. Stamping `confirmationSentAt` directly is what lets a test
 * place a number inside or outside the SMS signup reply window without asking
 * GoTrue to text anything.
 *
 * The manager builds its own Supabase admin client from the environment rather
 * than reusing `supabaseTestAdminClient`: that client is initialized by the
 * shared `setup.ts`, whose `vi.mock` calls (notably `@op/events`) would break
 * a project like `services/workflows` that deliberately skips that setup file.
 * The test environment always provides the URL and keys, so the client works
 * in every integration project.
 *
 * @example
 * ```ts
 * it('does something', async ({ task, onTestFinished }) => {
 *   const testData = new TestPhoneAuthDataManager(task.id, onTestFinished);
 *   const authUserId = await testData.createUser({
 *     phone: '+15005550007',
 *     confirmed: false,
 *     codeSentAt: new Date(),
 *   });
 *   // Cleanup runs automatically after the test finishes.
 * });
 * ```
 */
export class TestPhoneAuthDataManager {
  private onTestFinishedCallback: (fn: () => void | Promise<void>) => void;

  /** Auth user ids this instance created, for precise cleanup. */
  private createdAuthUserIds: string[] = [];

  private adminClient: TestAdminClient | null = null;

  constructor(
    _testId: string,
    onTestFinished: (fn: () => void | Promise<void>) => void,
  ) {
    this.onTestFinishedCallback = onTestFinished;
  }

  /**
   * The service-role client, created on first use from the test environment.
   * A lazily-created client keeps a test that never touches auth free of
   * network setup.
   */
  private getAdminClient() {
    if (!this.adminClient) {
      this.adminClient = createTestAdminClient();
    }
    return this.adminClient;
  }

  /**
   * Creates one `auth.users` row through the admin API and registers its
   * cleanup. The profile row a database trigger creates for the user is
   * removed with it.
   *
   * @returns The created auth user's id.
   */
  async createUser({
    phone,
    confirmed = false,
    codeSentAt,
  }: CreatePhoneUserOptions): Promise<string> {
    const { data, error } = await this.getAdminClient().auth.admin.createUser({
      phone,
      phone_confirm: confirmed,
    });

    if (error || !data.user) {
      throw new Error(`Failed to create phone user: ${error?.message}`);
    }

    const authUserId = data.user.id;
    this.createdAuthUserIds.push(authUserId);
    this.onTestFinishedCallback(() => this.cleanup(authUserId));

    if (codeSentAt) {
      await db
        .update(authUsers)
        .set({ confirmationSentAt: codeSentAt })
        .where(eq(authUsers.phone, toGoTruePhoneFormat(phone)));
    }

    return authUserId;
  }

  /**
   * Registers removal, when the test finishes, of whatever `auth.users` row
   * holds `phone` at that moment. Use it when the code under test creates the
   * row, so the test cannot know the id up front.
   */
  cleanupByPhoneOnFinish(phone: PhoneNumber): void {
    this.onTestFinishedCallback(() => this.removeByPhone(phone));
  }

  /**
   * Removes the `auth.users` row holding `phone`, and the profile row that
   * mirrors it. Does nothing when no row holds the number.
   */
  async removeByPhone(phone: PhoneNumber): Promise<void> {
    const [authUser] = await db
      .select({ id: authUsers.id })
      .from(authUsers)
      .where(eq(authUsers.phone, toGoTruePhoneFormat(phone)))
      .limit(1);

    if (!authUser) {
      return;
    }
    await this.cleanup(authUser.id);
  }

  /**
   * Removes the auth user and the profile row that mirrors it. The public
   * mirror is read first, because deleting the auth row takes the lookup key
   * with it.
   */
  private async cleanup(authUserId: string): Promise<void> {
    const [user] = await db
      .select({ profileId: users.profileId })
      .from(users)
      .where(eq(users.authUserId, authUserId))
      .limit(1);

    const { error } =
      await this.getAdminClient().auth.admin.deleteUser(authUserId);
    if (error && error.code !== 'user_not_found') {
      throw new Error(
        `Failed to delete phone user ${authUserId}: ${error.message}`,
      );
    }
    if (user?.profileId) {
      await db.delete(profiles).where(eq(profiles.id, user.profileId));
    }
  }
}
