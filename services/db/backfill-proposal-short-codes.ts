import { and, asc, eq, isNull, ne, sql } from 'drizzle-orm';

import { db } from '.';
import { ProcessStatus, profiles, ProposalStatus, proposals } from './schema';

interface Options {
  dryRun: boolean;
  instanceIds: string[];
}

interface InstanceReport {
  instanceId: string;
  name: string | null;
  scopeProfileId: string | null;
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
    columns: { id: true, name: true, profileId: true },
    orderBy: { createdAt: 'asc' },
  });

const assignShortCodes = (
  instanceId: string,
  scopeProfileId: string,
  dryRun: boolean,
): Promise<Pick<InstanceReport, 'assigned' | 'firstCode' | 'lastCode'>> =>
  db.transaction(async (tx) => {
    const [scope] = await tx
      .select({ next: profiles.nextShortCode })
      .from(profiles)
      .where(eq(profiles.id, scopeProfileId))
      .for('update');

    if (!scope) {
      throw new Error(
        `Profile ${scopeProfileId} of instance ${instanceId} disappeared mid-run`,
      );
    }

    const uncoded = await tx
      .select({ profileId: proposals.profileId })
      .from(proposals)
      .innerJoin(profiles, eq(profiles.id, proposals.profileId))
      .where(
        and(
          eq(proposals.processInstanceId, instanceId),
          ne(proposals.status, ProposalStatus.DRAFT),
          isNull(profiles.shortCode),
        ),
      )
      .orderBy(asc(proposals.createdAt), asc(proposals.id));

    const report = {
      assigned: uncoded.length,
      firstCode: uncoded.length > 0 ? scope.next : null,
      lastCode: uncoded.length > 0 ? scope.next + uncoded.length - 1 : null,
    };

    if (dryRun || uncoded.length === 0) {
      return report;
    }

    for (const [index, { profileId }] of uncoded.entries()) {
      await tx
        .update(profiles)
        .set({
          shortCode: scope.next + index,
          shortCodeScopeId: scopeProfileId,
        })
        .where(eq(profiles.id, profileId));
    }

    await tx
      .update(profiles)
      .set({
        nextShortCode: sql`${profiles.nextShortCode} + ${uncoded.length}`,
      })
      .where(eq(profiles.id, scopeProfileId));

    return report;
  });

const run = async (options: Options): Promise<InstanceReport[]> => {
  const targets = await listTargets(options);
  const reports: InstanceReport[] = [];
  for (const target of targets) {
    const base = {
      instanceId: target.id,
      name: target.name,
      scopeProfileId: target.profileId,
    };
    reports.push(
      target.profileId
        ? {
            ...base,
            ...(await assignShortCodes(
              target.id,
              target.profileId,
              options.dryRun,
            )),
          }
        : { ...base, assigned: 0, firstCode: null, lastCode: null },
    );
  }
  return reports;
};

const options = parseOptions(process.argv.slice(2));
const mode = options.dryRun ? 'dry run' : 'write';

console.log(`Backfill proposal short codes (${mode})`);

const reports = await run(options);

for (const report of reports) {
  const range =
    report.scopeProfileId === null
      ? 'no profile'
      : report.firstCode === null
        ? '-'
        : `${report.firstCode}..${report.lastCode}`;
  console.log(
    `${report.instanceId}  ${report.assigned} assigned  ${range}  ${report.name ?? ''}`,
  );
}

const total = reports.reduce((sum, report) => sum + report.assigned, 0);
const skipped = reports.filter((report) => report.scopeProfileId === null);
console.log(
  `${reports.length} published decisions, ${total} proposals ${options.dryRun ? 'would get' : 'got'} a code, ${skipped.length} decisions without a profile skipped`,
);

await db.$client.end();
