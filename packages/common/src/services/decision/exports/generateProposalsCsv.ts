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

// Infer the proposal type from the listProposals return value
type ProposalFromList = Awaited<
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
 * A process's custom template fields — anything beyond the fixed
 * title/description/budget/category/location columns above, e.g. a second
 * long-text question, a dropdown, or a money field a process author added.
 * These previously had no column at all, so their values were silently
 * dropped from the export: every process "with multiple parts to their
 * template" lost everything but its default fields.
 *
 * Every `rest` field gets its own column here, including `short-text`/
 * `long-text` ones — the template builder's "Add field" always starts a new
 * field as `short-text`, so the ordinary way a process ends up with
 * "multiple parts" is a second or third text question ("Problem statement",
 * "Proposed solution", ...), not a dropdown or money field. Excluding text
 * formats here on the theory that `collectProposalBodyDoc` already covers
 * them was the bug: that function folds every text-format field into one
 * `Description` cell with no separator between them, so a second text field
 * is not merely duplicated by omitting it here — it disappears as anything
 * a reader could attribute to its own question. This deliberately duplicates
 * that field's text into both `Description` (unchanged, for backward
 * compatibility) and its own column.
 *
 * `location`-keyed fields are excluded: that key already has dedicated
 * Address/Latitude/Longitude columns above.
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
 * A custom field's resolved value as CSV text. A string or list of strings
 * is resolved through the field's own schema first, since a `dropdown`/
 * `radio` value is stored as its `oneOf` `const` (e.g. `"high"`) rather than
 * the human-readable `title` (`"High"`) a reader of the export expects; a
 * field with no matching option (a plain text-ish custom field, or a value
 * that predates an option being renamed) keeps the raw string. Objects reuse
 * the same budget/location shape checks as the fixed columns above, since a
 * custom field can use the `money`/`location` `x-format` too; anything else
 * falls back to a JSON dump rather than dropping the value.
 */
function formatCustomFieldValue(
  value: unknown,
  schema: XFormatPropertySchema | undefined,
): string {
  if (value === null || value === undefined || value === '') {
    return '';
  }

  // `findSchemaOption` stringifies both sides before comparing, so it
  // matches a numeric `const` too — needed because `assembleProposalData`
  // has no dedicated case for `radio`, so a numeric-looking option (an
  // NPS-style scale's `"5"`) falls through its generic `JSON.parse` branch
  // as a number rather than staying a string.
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
    // A resolved value only reaches this branch as an object for `money`/
    // `location` fields (every other format resolves to a string or array,
    // handled above) — dispatch on the field's own `x-format` explicitly,
    // the same way `assembleProposalData` does for the live-document path,
    // rather than guessing the shape by trying both normalizers in turn: a
    // malformed `money` value that happens to have `lat`/`lng`-shaped junk
    // should fall through to the JSON dump below, not get misread as a
    // location.
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
 * Resolves every custom field column's value for one proposal from a single
 * shared `resolveDocumentFieldValues` result (see `buildProposalRow`): the
 * live document wherever its fragment resolved, falling back to the
 * creation-time snapshot — the same staleness rule the fixed
 * budget/category/location columns above follow.
 */
function resolveCustomFieldValues(
  snapshot: ProposalData,
  proposalTemplate: ProposalTemplateSchema | null,
  overrides: Record<string, unknown>,
  columns: CustomFieldColumn[],
): Record<string, string> {
  const values: Record<string, string> = {};
  for (const { key } of columns) {
    // `Object.hasOwn`, not `key in overrides` — `overrides` is a plain
    // object, so `in` also matches inherited `Object.prototype` keys
    // (`toString`, `constructor`, ...), which a slugified field title could
    // collide with and would otherwise resolve to a prototype method instead
    // of falling through to the snapshot.
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

  // One shared fragment walk for every overridable key — the fixed
  // budget/category/location columns and every custom column both read out
  // of this, rather than each re-running `assembleProposalData`'s per-property
  // scan of the whole template.
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
 * Every custom-field column across all proposals in the export, keyed and
 * ordered by first appearance. All proposals share one template today (one
 * export covers a single process instance), but computing the union rather
 * than reading only `proposals[0]`'s template keeps this correct even if
 * that ever changes — `csv-stringify` only infers columns from the first
 * record, silently dropping any later row's extra keys.
 *
 * `getCustomFieldColumns` is cached by `processInstanceId`, not by
 * `proposalTemplate` object identity: this export runs inside an Inngest
 * step function, where the proposals list is itself the durable, checkpointed
 * result of an earlier step — a boundary that can hand every proposal a
 * freshly-deserialized `proposalTemplate` even though they all describe the
 * same instance, which would defeat an identity-keyed cache on every row.
 *
 * A field's header must also be unique across the whole export: if a custom
 * field's title collides with a fixed column (a process author naming a
 * field "Status") or with another custom field's title, `csv-stringify`
 * would emit two identically-headed columns and any header-keyed reader
 * silently loses one of them. Colliding headers get the field's key appended
 * to disambiguate.
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

      const header = usedHeaders.has(column.header)
        ? `${column.header} (${column.key})`
        : column.header;
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
