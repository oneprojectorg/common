import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * `[auth.sms] enable_confirmations` decides whether GoTrue checks a code
 * before it sets `auth.users.phone_confirmed_at`.
 *
 * With confirmations off — GoTrue's SMS autoconfirm — a phone signup or a
 * phone change sets that column without any code, and GoTrue issues a session
 * for it. Anyone who can reach GoTrue could then sign in as a number they do
 * not hold. Membership reads an email address, so this admits nobody to the
 * closed network, but it hands out the account.
 *
 * This reads the files we ship. It does not run GoTrue, so it pins the setting
 * rather than the behaviour: the phone sign-in flow still has no end-to-end
 * coverage. It is here to fail loudly if the setting is reverted.
 *
 * The hosted project is configured in the Supabase dashboard, not from this
 * repository, so no test can reach it. Check it there before a release.
 */
const CONFIG_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../supabase',
);

describe('SMS autoconfirm', () => {
  const configs = readdirSync(CONFIG_DIR).filter(
    (name) => name.startsWith('supabase-') && name.endsWith('.toml'),
  );

  it('finds the Supabase configs', () => {
    // A rename would otherwise leave this suite asserting over an empty list.
    expect(configs.length).toBeGreaterThan(0);
  });

  it.each(configs)('%s requires a confirmation for SMS', (name) => {
    const sms = readSection(join(CONFIG_DIR, name), '[auth.sms]');

    expect(sms).toMatch(/^enable_confirmations = true$/m);
  });
});

/**
 * Returns one section of a TOML file, from its header to the next one.
 *
 * `[auth.email]` carries its own `enable_confirmations`, so a whole-file match
 * would read the wrong setting.
 */
const readSection = (path: string, header: string): string => {
  const contents = readFileSync(path, 'utf8');
  const start = contents.indexOf(`${header}\n`);

  if (start === -1) {
    throw new Error(`${path} has no ${header} section`);
  }

  const body = contents.slice(start + header.length);
  const end = body.indexOf('\n[');

  return end === -1 ? body : body.slice(0, end);
};
