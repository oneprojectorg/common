import { expect } from '@playwright/test';

/** The Mailpit instance `[inbucket]` in `supabase/supabase-e2e.toml` starts. */
const MAILPIT_URL = 'http://127.0.0.1:56324';

interface MailpitSearchResult {
  messages: Array<{ ID: string }>;
}

interface MailpitMessage {
  HTML: string;
}

/**
 * The login code GoTrue emailed to `to`, read from the newest message in
 * Mailpit. The e2e magic-link template renders `{{ .Token }}` inside a span
 * with `letter-spacing`, which is the only run of digits in that position.
 */
export const readLoginCode = async (to: string): Promise<string> => {
  let code: string | undefined;

  await expect
    .poll(
      async () => {
        code = await findLoginCode(to);
        return code;
      },
      {
        message: `No login code email for ${to} in Mailpit`,
        timeout: 20_000,
      },
    )
    .toBeDefined();

  if (!code) {
    throw new Error(`No login code email for ${to} in Mailpit`);
  }

  return code;
};

const findLoginCode = async (to: string): Promise<string | undefined> => {
  const search = await fetch(
    `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`,
  );

  if (!search.ok) {
    return undefined;
  }

  const { messages }: MailpitSearchResult = await search.json();
  const newest = messages[0];

  if (!newest) {
    return undefined;
  }

  const message = await fetch(`${MAILPIT_URL}/api/v1/message/${newest.ID}`);

  if (!message.ok) {
    return undefined;
  }

  const { HTML }: MailpitMessage = await message.json();

  return HTML.match(/letter-spacing[^>]*>\s*(\d+)\s*</)?.[1];
};
