import { logger } from '@op/logging';
import { and, asc, eq, isNull, ne, sql } from 'drizzle-orm';

import { db } from '.';
import {
  ProcessStatus,
  processInstances,
  ProposalStatus,
  proposals,
} from './schema';

interface Options {
  dryRun: boolean;
  instanceIds: string[];
}

interface InstanceReport {
  instanceId: string;
  name: string | null;
  assigned: number;
  firstCode: number | null;
  lastCode: number | null;
}

const parseOptions = (argv: string[]): Options => ({
  dryRun: argv.includes('--dry-run'),
  instanceIds: argv
    .filter((arg) => arg.startsWith('--instance='))
    .map((arg) => arg.slice('--instance='.length)),
});

const listTargets = ({ instanceIds }: Options) =>
  db.query.processInstances.findMany({
    where: {
      status: ProcessStatus.PUBLISHED,
      ...(instanceIds.length > 0 && { id: { in: instanceIds } }),
    },
    columns: { id: true, name: true },
    orderBy: { createdAt: 'asc' },
  });

const assignShortCodes = (
  instanceId: string,
  dryRun: boolean,
): Promise<Pick<InstanceReport, 'assigned' | 'firstCode' | 'lastCode'>> =>
  db.transaction(async (tx) => {
    const [instance] = await tx
      .select({ next: processInstances.nextShortCode })
      .from(processInstances)
      .where(eq(processInstances.id, instanceId))
      .for('update');

    if (!instance) {
      throw new Error(`Instance ${instanceId} disappeared mid-run`);
    }

    const uncoded = await tx
      .select({ id: proposals.id, updatedAt: proposals.updatedAt })
      .from(proposals)
      .where(
        and(
          eq(proposals.processInstanceId, instanceId),
          ne(proposals.status, ProposalStatus.DRAFT),
          isNull(proposals.shortCode),
        ),
      )
      .orderBy(asc(proposals.createdAt), asc(proposals.id));

    const report = {
      assigned: uncoded.length,
      firstCode: uncoded.length > 0 ? instance.next : null,
      lastCode: uncoded.length > 0 ? instance.next + uncoded.length - 1 : null,
    };

    if (dryRun || uncoded.length === 0) {
      return report;
    }

    for (const [index, { id, updatedAt }] of uncoded.entries()) {
      await tx
        .update(proposals)
        .set({ shortCode: instance.next + index, updatedAt })
        .where(eq(proposals.id, id));
    }

    await tx
      .update(processInstances)
      .set({
        nextShortCode: sql`${processInstances.nextShortCode} + ${uncoded.length}`,
      })
      .where(eq(processInstances.id, instanceId));

    return report;
  });

const run = async (options: Options): Promise<InstanceReport[]> => {
  const targets = await listTargets(options);
  const reports: InstanceReport[] = [];
  for (const target of targets) {
    reports.push({
      instanceId: target.id,
      name: target.name,
      ...(await assignShortCodes(target.id, options.dryRun)),
    });
  }
  return reports;
};

const options = parseOptions(process.argv.slice(2));
const mode = options.dryRun ? 'dry run' : 'write';

const say = (line: string) => process.stdout.write(`${line}\n`);

say(`Backfill proposal short codes (${mode})`);
logger.info('Backfill proposal short codes started', { mode });

const reports = await run(options);

for (const report of reports) {
  const range =
    report.firstCode === null ? '-' : `${report.firstCode}..${report.lastCode}`;
  say(
    `${report.instanceId}  ${report.assigned} assigned  ${range}  ${report.name ?? ''}`,
  );
  logger.info('Backfill proposal short codes assigned', {
    mode,
    instanceId: report.instanceId,
    assigned: report.assigned,
    firstCode: report.firstCode,
    lastCode: report.lastCode,
  });
}

const total = reports.reduce((sum, report) => sum + report.assigned, 0);
say(
  `${reports.length} published decisions, ${total} proposals ${options.dryRun ? 'would get' : 'got'} a code`,
);
logger.info('Backfill proposal short codes finished', {
  mode,
  decisions: reports.length,
  proposals: total,
});

await logger.flush();
await db.$client.end();
