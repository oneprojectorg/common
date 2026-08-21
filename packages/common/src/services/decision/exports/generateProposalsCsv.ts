import { stringify } from 'csv-stringify/sync';

import { getProposalTemplateFieldOrder } from '../getProposalTemplateFieldOrder';
import type { listProposals } from '../listProposals';
import {
  findSchemaOption,
  formatProposalCategories,
  getPlaceCoordinates,
  getSchemaFieldTitle,
  type LocationData,
  normalizeBudget,
  normalizeLocation,
  normalizeProposalCategories,
  type ProposalData,
  parseProposalData,
} from '../proposalDataSchema';
import {
  collectProposalBodyDoc,
  resolveBudgetOverride,
  resolveDocumentFieldValues,
} from '../proposalListPreview';
import { tiptapDocToPlainText } from '../tiptapDocToPlainText';
import type { ProposalTemplateSchema, XFormatPropertySchema } from '../types';

// Infer the proposal type from the listProposals return value. Exported as the
// row contract for this CSV: `listProposalsForExport` returns it and the export
// workflow passes it straight through, so all three agree on one definition
// instead of each re-deriving its own.
export type ProposalFromList = Awaited<
  ReturnType<typeof listProposals>
>['proposals'][number];

/**
 * Plain text of a proposal's body, for the Description column.
 *
 * Reads the same fragments the list preview and the proposal page render, via
 * the shared walk. It previously read only `fragments.default` — the legacy
 * single-fragment shape — so every proposal on a template exported an empty
 * description while legacy proposals kept working, which is why it went
 * unnoticed. Templated documents key their fragments by field name (`summary`
 * for the current templates).
 */
function getDocumentDescription(
  proposal: ProposalFromList,
  snapshot: ProposalData,
): string {
  const documentContent = proposal.documentContent;

  if (documentContent?.type === 'json') {
    const bodyDoc = collectProposalBodyDoc({
      fragments: documentContent.fragments,
      proposalTemplate: proposal.proposalTemplate ?? null,
    });

    if (!bodyDoc) {
      return '';
    }

    try {
      return tiptapDocToPlainText(bodyDoc).trim();
    } catch {
      // Malformed live doc — same "keep the snapshot" fallback the
      // budget/category/location overrides use below.
      return snapshot.description?.trim() || '';
    }
  }

  return snapshot.description?.trim() || '';
}

/** Template field keys whose live document value can override the snapshot below. */
const OVERRIDABLE_FIELD_KEYS = ['budget', 'category', 'location'] as const;

/**
 * Only a string or array resolution counts as "the document set a
 * category" — `assembleProposalData`'s generic JSON-parse fallback can
 * resolve a malformed fragment to a number/boolean/object, which
 * `normalizeProposalCategories` would otherwise silently collapse to `[]`,
 * indistinguishable from a deliberate "cleared every category" edit (a
 * genuine `[]` from a real string/array parse). Treating only the latter as
 * resolved keeps a malformed fragment from blanking `existing` while still
 * letting a real clear come through.
 */
function resolveCategoryOverride(raw: unknown, existing: string[]): string[] {
  const isResolved =
    typeof raw === 'string' ||
    (Array.isArray(raw) && raw.every((value) => typeof value === 'string'));

  return isResolved ? normalizeProposalCategories(raw) : existing;
}

/**
 * Coordinates from a resolved location are always trusted (a pin drop is
 * never stale the way an address lookup can be pending); a missing
 * `address`/`placeId` — an ungeocoded pin, plausible mid-edit before the
 * async reverse-geocode has resolved — falls back to `existing`'s label
 * field-by-field, since a stale label beats none until the resolve catches
 * up. `existing`'s `placeLat`/`placeLng` are never carried forward: those
 * pin the *old* geocoded point, and `getPlaceCoordinates` prefers them over
 * `lat`/`lng` — keeping them would have the new pin's own coordinates lose
 * to the stale ones they exist to override.
 */
function resolveLocationOverride(
  raw: unknown,
  existing: LocationData | null | undefined,
): LocationData | undefined {
  const resolved = normalizeLocation(raw);
  if (!resolved) {
    return existing ?? undefined;
  }

  return {
    ...resolved,
    address: resolved.address ?? existing?.address,
    placeId: resolved.placeId ?? existing?.placeId,
  };
}

/**
 * The proposal's snapshot data, with `budget`/`category`/`location`
 * overridden by the live document wherever it resolved successfully — the
 * authoritative values, since `proposalData` is a creation-time snapshot
 * that goes stale once a field is edited in the collab doc after submission.
 * A malformed or missing fragment keeps the snapshot value rather than
 * blanking a previously-valid column.
 */
function resolveProposalData(
  snapshot: ProposalData,
  overrides: Record<string, unknown>,
): ProposalData {
  return {
    ...snapshot,
    budget: resolveBudgetOverride(overrides.budget, snapshot.budget),
    category: resolveCategoryOverride(overrides.category, snapshot.category),
    location: resolveLocationOverride(overrides.location, snapshot.location),
  };
}

/** One CSV column for a template field that isn't part of the fixed set above. */
interface CustomFieldColumn {
  key: string;
  header: string;
}

/**
 * One column per template field beyond the fixed set above, including
 * `short-text`/`long-text` fields: `collectProposalBodyDoc` folds those into
 * `Description` with no separator between them, so a second text field still
 * needs its own column to stay attributable to its own question.
 * `location` is excluded — it already has dedicated Address/Lat/Lng columns.
 */
function getCustomFieldColumns(
  proposalTemplate: ProposalTemplateSchema | null | undefined,
): CustomFieldColumn[] {
  if (!proposalTemplate?.properties) {
    return [];
  }

  const properties = proposalTemplate.properties;

  return getProposalTemplateFieldOrder(proposalTemplate)
    .rest.filter((key) => key !== 'location')
    .map((key) => ({
      key,
      header: getSchemaFieldTitle(properties[key], key),
    }));
}

/**
 * A custom field's value as CSV text: strings/numbers resolve through the
 * field's schema options first (a `dropdown`/`radio` value is its raw
 * `const`, not its display title); money/location values render as
 * readable text; anything else falls back to a JSON dump.
 */
function formatCustomFieldValue(
  value: unknown,
  schema: XFormatPropertySchema | undefined,
): string {
  if (value === null || value === undefined || value === '') {
    return '';
  }

  // `findSchemaOption` stringifies both sides, so it also matches a `radio`
  // scale's numeric-looking `const` (e.g. `"5"`), which resolves as a
  // number rather than a string.
  if (typeof value === 'string' || typeof value === 'number') {
    return findSchemaOption(schema, value)?.title ?? String(value);
  }

  if (Array.isArray(value)) {
    return value.every(
      (entry) => typeof entry === 'string' || typeof entry === 'number',
    )
      ? value
          .map(
            (entry) => findSchemaOption(schema, entry)?.title ?? String(entry),
          )
          .join(', ')
      : JSON.stringify(value);
  }

  if (typeof value === 'object') {
    // Only `money`/`location` fields resolve to an object here — dispatch
    // on the field's own `x-format` rather than guessing via both
    // normalizers, so a malformed value can't get misread as the other
    // shape.
    if (schema?.['x-format'] === 'money') {
      const budget = normalizeBudget(value);
      if (budget) {
        return `${budget.amount} ${budget.currency}`;
      }
    } else if (schema?.['x-format'] === 'location') {
      const location = normalizeLocation(value);
      if (location) {
        return location.address ?? `${location.lat}, ${location.lng}`;
      }
    }

    return JSON.stringify(value);
  }

  return String(value);
}

/**
 * Every custom column's value for one proposal, from the shared `overrides`
 * result (see `buildProposalRow`), falling back to the snapshot.
 */
function resolveCustomFieldValues(
  snapshot: ProposalData,
  proposalTemplate: ProposalTemplateSchema | null,
  overrides: Record<string, unknown>,
  columns: CustomFieldColumn[],
): Record<string, string> {
  const values: Record<string, string> = {};
  for (const { key } of columns) {
    // `Object.hasOwn`, not `key in` — `in` also matches inherited
    // `Object.prototype` keys (`toString`, ...), which a field key could
    // collide with.
    const raw = Object.hasOwn(overrides, key) ? overrides[key] : snapshot[key];
    values[key] = formatCustomFieldValue(
      raw,
      proposalTemplate?.properties?.[key],
    );
  }
  return values;
}

// Flat one-column-per-field CSV row builder; the count is 17 independent
// optional-chaining/fallback expressions, not branching logic, and splitting
// it further would only obscure the column list.
// fallow-ignore-next-line complexity
function buildProposalRow(
  p: ProposalFromList,
  customFieldColumns: CustomFieldColumn[],
) {
  const snapshot = parseProposalData(p.proposalData);
  const documentContent = p.documentContent;
  const proposalTemplate = p.proposalTemplate ?? null;

  // One shared fragment walk for every overridable key, fixed and custom.
  const overrides =
    documentContent?.type === 'json'
      ? resolveDocumentFieldValues({
          fragments: documentContent.fragments,
          proposalTemplate,
          keys: [
            ...OVERRIDABLE_FIELD_KEYS,
            ...customFieldColumns.map((column) => column.key),
          ],
        })
      : {};

  const proposalData = resolveProposalData(snapshot, overrides);

  // Geocoded place coordinates, so co-located ideas plot on one point rather
  // than scattering by however precisely each submitter dropped their pin.
  // `getPlaceCoordinates` falls back to the pin when the geocoder found no
  // match — emitting blanks there would silently drop those ideas off the
  // map, which is the opposite of what this export is for.
  const place = proposalData.location
    ? getPlaceCoordinates(proposalData.location)
    : undefined;

  return {
    'Proposal ID': p.id,
    Title: p.profile?.name || '',
    Description: getDocumentDescription(p, snapshot),
    Budget: proposalData.budget?.amount ?? '',
    Currency: proposalData.budget?.currency ?? '',
    Categories: formatProposalCategories(proposalData.category),
    Address: proposalData.location?.address ?? '',
    Latitude: place?.lat ?? '',
    Longitude: place?.lng ?? '',
    Status: p.status,
    'Submitted By': p.submittedBy?.name || '',
    'Profile ID': p.profileId,
    Likes: p.likesCount || 0,
    Comments: p.commentsCount || 0,
    Followers: p.followersCount || 0,
    'Created At': p.createdAt ? new Date(p.createdAt).toISOString() : '',
    'Updated At': p.updatedAt ? new Date(p.updatedAt).toISOString() : '',
    ...resolveCustomFieldValues(
      snapshot,
      proposalTemplate,
      overrides,
      customFieldColumns,
    ),
  };
}

/**
 * Every custom-field column across all proposals, deduped and ordered by
 * first appearance, with headers disambiguated against collisions (a custom
 * field's title colliding with a fixed column or another field's title).
 *
 * Cached by `processInstanceId`, not `proposalTemplate` identity: this
 * export runs inside an Inngest step function, where the proposals list can
 * cross a checkpoint boundary that hands back a freshly-deserialized
 * template per row even when they all describe the same instance.
 */
function collectCustomFieldColumns(
  proposals: ProposalFromList[],
): CustomFieldColumn[] {
  const usedHeaders = new Set<string>(FIXED_COLUMNS);
  const columns = new Map<string, CustomFieldColumn>();
  const columnsByInstance = new Map<string, CustomFieldColumn[]>();

  for (const p of proposals) {
    if (!p.proposalTemplate) {
      continue;
    }

    let instanceColumns = columnsByInstance.get(p.processInstanceId);
    if (!instanceColumns) {
      instanceColumns = getCustomFieldColumns(p.proposalTemplate);
      columnsByInstance.set(p.processInstanceId, instanceColumns);
    }

    for (const column of instanceColumns) {
      if (columns.has(column.key)) {
        continue;
      }

      // Loop, not a single check-and-append — the fallback itself can
      // already be taken by another field's literal title.
      let header = column.header;
      while (usedHeaders.has(header)) {
        header = `${header} (${column.key})`;
      }
      usedHeaders.add(header);
      columns.set(column.key, { key: column.key, header });
    }
  }

  return [...columns.values()];
}

const FIXED_COLUMNS = [
  'Proposal ID',
  'Title',
  'Description',
  'Budget',
  'Currency',
  'Categories',
  'Address',
  'Latitude',
  'Longitude',
  'Status',
  'Submitted By',
  'Profile ID',
  'Likes',
  'Comments',
  'Followers',
  'Created At',
  'Updated At',
];

export async function generateProposalsCsv(
  proposals: ProposalFromList[],
): Promise<string> {
  const customFieldColumns = collectCustomFieldColumns(proposals);
  const rows = proposals.map((p) => buildProposalRow(p, customFieldColumns));

  return stringify(rows, {
    header: true,
    quoted: true,
    columns: [
      ...FIXED_COLUMNS.map((header) => ({ key: header, header })),
      ...customFieldColumns.map(({ key, header }) => ({ key, header })),
    ],
  });
}
