/**
 * Imports geographic boundaries from a GeoJSON file into `decision_boundaries`,
 * creating/linking a matching proposal category for each.
 *
 * Usage (dev or prod — targets whatever DATABASE_URL points at):
 *   pnpm --filter @op/common import:boundaries \
 *     --file path/to/districts.geojson --name-property NAME
 *
 * `--name-property` is the GeoJSON Feature property whose value becomes the
 * boundary name AND the linked category label. Idempotent: re-running updates
 * existing boundaries (matched case-insensitively by name) in place.
 *
 * Cannot import the app's service layer (`@op/db/client` is `server-only`), so
 * it talks to the DB via the `@op/db` index and replicates the proposal-term
 * `slugify` logic from `proposalTaxonomy.ts` verbatim so term URIs match.
 */
import { eq, sql } from 'drizzle-orm';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import slugify from 'slugify';

interface GeoJsonFeature {
  type: 'Feature';
  geometry: unknown;
  properties: Record<string, unknown> | null;
}

async function loadEnv(): Promise<void> {
  // Prefer an already-set DATABASE_URL (prod/CI); only then fall back to the
  // monorepo root .env.local for local dev. Runs before the db client loads.
  if (process.env.DATABASE_URL) {
    return;
  }

  try {
    const dotenv = await import('dotenv');
    const root = resolve(
      dirname(fileURLToPath(import.meta.url)),
      '../../../../.env.local',
    );

    if (existsSync(root)) {
      dotenv.config({ path: root, override: false });
    }

    dotenv.config({ override: false });
  } catch {
    // dotenv unavailable — rely on the ambient environment.
  }
}

function parseCliArgs(): { file: string; nameProperty: string } {
  const { values } = parseArgs({
    options: {
      file: { type: 'string' },
      'name-property': { type: 'string' },
    },
  });

  if (!values.file || !values['name-property']) {
    throw new Error(
      'Usage: import:boundaries --file <path> --name-property <geojsonProperty>',
    );
  }

  return { file: values.file, nameProperty: values['name-property'] };
}

async function main(): Promise<void> {
  const { file, nameProperty } = parseCliArgs();
  await loadEnv();

  const rawFile = await readFile(resolve(process.cwd(), file), 'utf8');
  const parsed = JSON.parse(rawFile);
  const features: GeoJsonFeature[] =
    parsed?.type === 'FeatureCollection' ? (parsed.features ?? []) : [parsed];

  // Dynamic import so loadEnv() runs before the db client reads DATABASE_URL.
  const { db } = await import('@op/db');
  const { decisionBoundaries, taxonomies, taxonomyTerms } =
    await import('@op/db/schema');

  /**
   * Ensure the proposal category term for `label`. Mirrors
   * `ensureProposalTaxonomyTerms` (same slugify options) so the term URI is
   * identical to the one an admin-created category would produce.
   */
  async function ensureCategoryTerm(label: string): Promise<string> {
    const termUri = slugify(label, { lower: true, strict: true, trim: true });

    const [existing] = await db
      .select({ id: taxonomyTerms.id })
      .from(taxonomyTerms)
      .where(eq(taxonomyTerms.termUri, termUri))
      .limit(1);

    if (existing) {
      return existing.id;
    }

    const [taxonomy] = await db
      .select({ id: taxonomies.id })
      .from(taxonomies)
      .where(eq(taxonomies.name, 'proposal'))
      .limit(1);

    let taxonomyId = taxonomy?.id;

    if (!taxonomyId) {
      const [created] = await db
        .insert(taxonomies)
        .values({
          name: 'proposal',
          description:
            'Categories for organizing proposals in decision-making processes',
        })
        .returning();
      taxonomyId = created!.id;
    }

    const [term] = await db
      .insert(taxonomyTerms)
      .values({
        taxonomyId,
        termUri,
        label,
        definition: `Category for ${label} proposals`,
      })
      .returning();

    return term!.id;
  }

  let imported = 0;
  let skipped = 0;

  for (const feature of features) {
    const rawName = feature?.properties?.[nameProperty];

    if (typeof rawName !== 'string' || !rawName.trim()) {
      console.warn(
        `Skipping feature with missing/invalid "${nameProperty}" property`,
      );
      skipped += 1;
      continue;
    }

    if (!feature.geometry) {
      console.warn(`Skipping "${rawName}": no geometry`);
      skipped += 1;
      continue;
    }

    const name = rawName.trim();
    const taxonomyTermId = await ensureCategoryTerm(name);
    const geomJson = JSON.stringify(feature.geometry);
    // ST_MakeValid repairs self-intersecting/ill-formed source polygons (else
    // ST_Contains is unreliable); CollectionExtract(_, 3) keeps only polygonal
    // parts before normalizing to MultiPolygon in WGS84.
    const boundarySql = sql`ST_SetSRID(ST_Multi(ST_CollectionExtract(ST_MakeValid(ST_GeomFromGeoJSON(${geomJson})), 3)), 4326)`;
    const metadata = feature.properties ?? null;

    // Manual upsert keyed on the case-insensitive name (the unique index is on
    // lower(name), an expression index, so ON CONFLICT can't target it cleanly).
    const [existingBoundary] = await db
      .select({ id: decisionBoundaries.id })
      .from(decisionBoundaries)
      .where(sql`lower(${decisionBoundaries.name}) = ${name.toLowerCase()}`)
      .limit(1);

    if (existingBoundary) {
      await db
        .update(decisionBoundaries)
        .set({ name, taxonomyTermId, boundary: boundarySql, metadata })
        .where(eq(decisionBoundaries.id, existingBoundary.id));
    } else {
      await db
        .insert(decisionBoundaries)
        .values({ name, taxonomyTermId, boundary: boundarySql, metadata });
    }

    imported += 1;
  }

  console.log(
    `Imported ${imported} boundaries from ${file}` +
      (skipped > 0 ? ` (${skipped} skipped)` : ''),
  );

  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
