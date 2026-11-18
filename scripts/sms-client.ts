/**
 * A local phone for the Twilio inbound webhook.
 *
 * Posts Twilio-shaped form payloads to the local api server, signed with
 * TWILIO_AUTH_TOKEN the same way Twilio signs them, so no Twilio account is
 * needed. When the server runs with TWILIO_FAKE_SMS_OUTBOX, replies land in
 * that file and this client prints the ones addressed to you, so the terminal
 * reads as a conversation.
 *
 * Usage:
 *   pnpm sms:client [--from +15005550006] [--to <line number>] [message]
 *
 * With a message argument it sends once and waits briefly for a reply; with
 * none it opens a prompt and each line you type is one inbound text.
 *
 * Needs: the api server on :3101, the Inngest dev server
 * (pnpm w:workflows dev), TWILIO_AUTH_TOKEN set to the same string in the
 * server env and here (.env.local is read as a fallback), and
 * TWILIO_FAKE_SMS_OUTBOX set in the server env to see replies. GoTrue
 * signup codes (the JOIN flow) still need real Twilio Verify.
 */
import { createHmac, randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { open, stat } from 'node:fs/promises';
import { createInterface } from 'node:readline';

const DEFAULT_URL = 'http://localhost:3101/api/v1/notifications/twilio/inbound';
const DEFAULT_FROM = '+15005550006';
const POLL_MS = 300;

interface OutboxLine {
  at: string;
  to: string;
  from: string | null;
  body: string;
}

const readEnvLocal = (): Record<string, string> => {
  if (!existsSync('.env.local')) {
    return {};
  }
  const values: Record<string, string> = {};
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const match = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match || !match[1] || match[2] === undefined) {
      continue;
    }
    values[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
  return values;
};

const envLocal = readEnvLocal();
const env = (key: string): string | undefined =>
  process.env[key] ?? envLocal[key];

const parseArgs = () => {
  const args = process.argv.slice(2);
  const flags: Record<string, string> = {};
  const rest: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === '--from' || arg === '--to' || arg === '--url') {
      const value = args[++i];
      if (!value) {
        console.error(`${arg} needs a value`);
        process.exit(1);
      }
      flags[arg.slice(2)] = value;
    } else {
      rest.push(arg);
    }
  }
  return { flags, message: rest.join(' ') };
};

const signTwilioRequest = (
  authToken: string,
  url: string,
  params: Record<string, string>,
): string => {
  const data =
    url +
    Object.keys(params)
      .sort()
      .map((key) => key + params[key])
      .join('');
  return createHmac('sha1', authToken).update(data, 'utf8').digest('base64');
};

const sendInbound = async ({
  url,
  authToken,
  from,
  to,
  body,
}: {
  url: string;
  authToken: string;
  from: string;
  to: string | undefined;
  body: string;
}): Promise<void> => {
  const params: Record<string, string> = {
    MessageSid: `SM${randomBytes(16).toString('hex')}`,
    From: from,
    Body: body,
    ...(to ? { To: to } : {}),
  };
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Twilio-Signature': signTwilioRequest(authToken, url, params),
      },
      body: new URLSearchParams(params).toString(),
    });
  } catch {
    console.error(`Could not reach ${url}. Is the api server running?`);
    return;
  }
  if (response.status === 503) {
    console.error(
      'Server answered 503: TWILIO_AUTH_TOKEN is unset in the api server env.',
    );
  } else if (response.status === 401) {
    console.error(
      'Server answered 401: signature mismatch. TWILIO_AUTH_TOKEN here must equal the api server one, and --url must be the exact URL the server sees.',
    );
  } else if (!response.ok) {
    console.error(`Server answered ${response.status}.`);
  }
};

const watchOutbox = (path: string, forNumber: string): (() => void) => {
  let offset = 0;
  let carry = '';
  let initialized = false;

  const poll = async () => {
    try {
      const { size } = await stat(path);
      if (!initialized) {
        offset = size;
        initialized = true;
        return;
      }
      if (size <= offset) {
        return;
      }
      const handle = await open(path, 'r');
      try {
        const { buffer, bytesRead } = await handle.read({
          buffer: Buffer.alloc(size - offset),
          position: offset,
        });
        offset += bytesRead;
        carry += buffer.toString('utf8', 0, bytesRead);
      } finally {
        await handle.close();
      }
      const lines = carry.split('\n');
      carry = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.trim()) {
          continue;
        }
        try {
          const message: OutboxLine = JSON.parse(line);
          if (message.to === forNumber) {
            for (const part of message.body.split('\n')) {
              console.log(`  ${part}`);
            }
            console.log('');
          }
        } catch {
          continue;
        }
      }
    } catch {
      initialized = false;
    }
  };

  const timer = setInterval(() => {
    void poll();
  }, POLL_MS);
  return () => clearInterval(timer);
};

const main = async () => {
  const { flags, message } = parseArgs();
  const authToken = env('TWILIO_AUTH_TOKEN');
  if (!authToken) {
    console.error(
      'TWILIO_AUTH_TOKEN is not set (env or .env.local). Set it to the same string the api server uses; any value works, no Twilio account needed.',
    );
    process.exit(1);
  }
  const url = flags.url ?? DEFAULT_URL;
  const from = flags.from ?? DEFAULT_FROM;
  const to = flags.to;
  const outbox = env('TWILIO_FAKE_SMS_OUTBOX');

  const stopWatching = outbox ? watchOutbox(outbox, from) : null;
  if (!outbox) {
    console.error(
      'TWILIO_FAKE_SMS_OUTBOX is not set, so replies will not be shown here. Set it (same path) in the api server env and in .env.local to see them.',
    );
  }

  console.log(
    `texting as ${from}${to ? ` to line ${to}` : ''} -> ${url}`,
  );

  if (message) {
    await sendInbound({ url, authToken, from, to, body: message });
    if (stopWatching) {
      await new Promise((resolve) => setTimeout(resolve, 8000));
      stopWatching();
    }
    return;
  }

  const repl = createInterface({ input: process.stdin, output: process.stdout });
  repl.setPrompt('you> ');
  repl.prompt();
  repl.on('line', (line) => {
    const body = line.trim();
    if (!body) {
      repl.prompt();
      return;
    }
    void sendInbound({ url, authToken, from, to, body }).then(() =>
      repl.prompt(),
    );
  });
  repl.on('close', () => {
    stopWatching?.();
    process.exit(0);
  });
};

void main();
