import { stringify } from 'csv-stringify/sync';

import type { listProposals } from '../listProposals';
import {
  formatProposalCategories,
  getPlaceCoordinates,
  type LocationData,
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
  proposal: ProposalFromList,
  snapshot: ProposalData,
): ProposalData {
  const documentContent = proposal.documentContent;
  const overrides =
    documentContent?.type === 'json'
      ? resolveDocumentFieldValues({
          fragments: documentContent.fragments,
          proposalTemplate: proposal.proposalTemplate ?? null,
          keys: OVERRIDABLE_FIELD_KEYS,
        })
      : {};

  return {
    ...snapshot,
    budget: resolveBudgetOverride(overrides.budget, snapshot.budget),
    category: resolveCategoryOverride(overrides.category, snapshot.category),
    location: resolveLocationOverride(overrides.location, snapshot.location),
  };
}

// Flat one-column-per-field CSV row builder; the count is 17 independent
// optional-chaining/fallback expressions, not branching logic, and splitting
// it further would only obscure the column list.
// fallow-ignore-next-line complexity
function buildProposalRow(p: ProposalFromList) {
  const snapshot = parseProposalData(p.proposalData);
  const proposalData = resolveProposalData(p, snapshot);

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
  };
}

export async function generateProposalsCsv(
  proposals: ProposalFromList[],
): Promise<string> {
  const rows = proposals.map(buildProposalRow);

  return stringify(rows, {
    header: true,
    quoted: true,
  });
}
