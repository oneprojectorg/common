import { and, asc, eq, isNull, sql } from 'drizzle-orm';

import { db } from '.';
import { ProcessStatus, processInstances, proposals } from './schema';

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
): Promise<Omit<InstanceReport, 'name'>> =>
  db.transaction(async (tx) => {
    const [locked] = await tx
      .select({ next: processInstances.nextShortCode })
      .from(processInstances)
      .where(eq(processInstances.id, instanceId))
      .for('update');

    if (!locked) {
      throw new Error(`Process instance ${instanceId} disappeared mid-run`);
    }

    const uncoded = await tx
      .select({ id: proposals.id })
      .from(proposals)
      .where(
        and(
          eq(proposals.processInstanceId, instanceId),
          isNull(proposals.shortCode),
        ),
      )
      .orderBy(asc(proposals.createdAt), asc(proposals.id));

    const report = {
      instanceId,
      assigned: uncoded.length,
      firstCode: uncoded.length > 0 ? locked.next : null,
      lastCode: uncoded.length > 0 ? locked.next + uncoded.length - 1 : null,
    };

    if (dryRun || uncoded.length === 0) {
      return report;
    }

    for (const [index, proposal] of uncoded.entries()) {
      await tx
        .update(proposals)
        .set({ shortCode: locked.next + index })
        .where(eq(proposals.id, proposal.id));
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
    const report = await assignShortCodes(target.id, options.dryRun);
    reports.push({ ...report, name: target.name });
  }
  return reports;
};

const options = parseOptions(process.argv.slice(2));
const mode = options.dryRun ? 'dry run' : 'write';

console.log(`Backfill proposal short codes (${mode})`);

const reports = await run(options);

for (const report of reports) {
  const range =
    report.firstCode === null ? '-' : `${report.firstCode}..${report.lastCode}`;
  console.log(
    `${report.instanceId}  ${report.assigned} assigned  ${range}  ${report.name ?? ''}`,
  );
}

const total = reports.reduce((sum, report) => sum + report.assigned, 0);
console.log(
  `${reports.length} published decisions, ${total} proposals ${options.dryRun ? 'would get' : 'got'} a code`,
);

await db.$client.end();
