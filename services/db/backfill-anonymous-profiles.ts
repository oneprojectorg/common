import { logger } from '@op/logging';
import { and, eq, not, sql } from 'drizzle-orm';

import { db } from '.';
import { EntityType, profiles } from './schema';

const dryRun = process.argv.includes('--dry-run');
const mode = dryRun ? 'dry run' : 'write';

const say = (line: string) => process.stdout.write(`${line}\n`);

const matchFilter = and(
  eq(profiles.type, EntityType.INDIVIDUAL),
  not(profiles.isAnonymous),
  sql`${profiles.name} ~ '^Participant \\d+$'`,
);

say(`Backfill anonymous profiles (${mode})`);
logger.info('Backfill anonymous profiles started', { mode });

let count: number;
if (dryRun) {
  const rows = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(matchFilter);
  count = rows.length;
} else {
  const rows = await db
    .update(profiles)
    .set({
      isAnonymous: true,
      updatedAt: sql`${profiles.updatedAt}`,
    })
    .where(matchFilter)
    .returning({ id: profiles.id });
  count = rows.length;
}

say(`${count} profiles ${dryRun ? 'would be' : ''} marked anonymous`.trim());
logger.info('Backfill anonymous profiles finished', { mode, count });

await logger.flush();
await db.$client.end();
