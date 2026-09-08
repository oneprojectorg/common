/**
 * Opens a profile to the public from a terminal, closes it again, or reports
 * which it is.
 *
 * A public decision profile lets a visitor with no account read the process and
 * its proposals. Use this to set that state up on a local database, where the
 * `profile.setProfilePublic` endpoint is out of reach because nobody is signed
 * in.
 *
 * This calls the same service the endpoint calls, so it writes the sentinel
 * grant rows and invalidates the access cache. Writing the rows by hand leaves
 * a stale cache and the change does not take effect.
 *
 * Usage:
 *   pnpm profile:public status <profileId>
 *   pnpm profile:public open   <profileId> <adminAuthUserId>
 *   pnpm profile:public close  <profileId> <adminAuthUserId>
 *
 * `adminAuthUserId` is the `auth.users.id` of a person who administers the
 * profile. The service refuses every other caller.
 */

type Command = 'status' | 'open' | 'close';

const USAGE = [
  'Usage:',
  '  pnpm profile:public status <profileId>',
  '  pnpm profile:public open   <profileId> <adminAuthUserId>',
  '  pnpm profile:public close  <profileId> <adminAuthUserId>',
].join('\n');

const run = async (): Promise<void> => {
  const [command, profileId, adminAuthUserId] = process.argv.slice(2);

  if (!command || !isCommand(command) || !profileId) {
    console.error(USAGE);
    process.exit(1);
  }

  if (command !== 'status' && !adminAuthUserId) {
    console.error(`"${command}" needs an admin auth user id.\n\n${USAGE}`);
    process.exit(1);
  }

  // `@op/common` transpiles to CommonJS, so Node's ESM linker cannot enumerate
  // its named exports and a static import fails to bind them. A dynamic import
  // reads them at runtime instead.
  const { isProfilePublic, makeProfilePublic, revokeProfilePublicAccess } =
    await import('@op/common');

  const before = await isProfilePublic(profileId);

  if (command === 'open' && adminAuthUserId) {
    await makeProfilePublic({ profileId, user: { id: adminAuthUserId } });
  }

  if (command === 'close' && adminAuthUserId) {
    await revokeProfilePublicAccess({
      profileId,
      user: { id: adminAuthUserId },
    });
  }

  const after = await isProfilePublic(profileId);

  console.log(JSON.stringify({ command, profileId, before, after }, null, 2));

  // The database and cache clients hold the process open otherwise.
  process.exit(0);
};

const isCommand = (value: string): value is Command =>
  value === 'status' || value === 'open' || value === 'close';

run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
