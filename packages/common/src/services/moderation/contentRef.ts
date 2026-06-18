import type { ModerationItemType } from './types';

// itemType is a fixed keyword and itemId/roundId are uuids, none of which
// contain the separator, so a plain split round-trips safely.
const SEP = ':';
const ITEM_TYPES: ReadonlySet<string> = new Set([
  'proposal',
  'post',
  'user',
] satisfies ModerationItemType[]);
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Narrows a string (a webhook ref segment, a widened db enum column) to a
 *  known moderation item type. */
export const isModerationItemType = (
  value: string | undefined,
): value is ModerationItemType => value !== undefined && ITEM_TYPES.has(value);

export interface ContentRef {
  itemType: ModerationItemType;
  itemId: string;
  /**
   * The submission round this ref belongs to. A re-submission (after an edit,
   * or a fresh report) mints a new round id, so a delayed webhook for a
   * superseded round can't be mistaken for a verdict on the current one.
   */
  roundId: string;
  /** Set when the submission is a single attachment of a multi-part item. */
  mediaId?: string;
}

/**
 * Encodes our polymorphic item ref as the provider's content id:
 * `itemType:itemId:roundId[:mediaId]`. The provider echoes it back on the
 * async webhook, letting us correlate the verdict to the item *and* to the
 * exact submission round — verdicts whose round no longer matches are
 * dropped. `mediaId` distinguishes the per-attachment submissions of one item
 * (text + N media each get their own id).
 */
export const encodeContentRef = (
  itemType: ModerationItemType,
  itemId: string,
  roundId: string,
  mediaId?: string,
): string =>
  [itemType, itemId, roundId, ...(mediaId ? [mediaId] : [])].join(SEP);

/** Recovers the item ref from a provider content id. Throws on a malformed or
 *  unknown ref so a bad webhook payload fails loudly rather than mis-routing. */
export const decodeContentRef = (ref: string): ContentRef => {
  const parts = ref.split(SEP);
  const [itemType, itemId, roundId, mediaId] = parts;
  // The ref is webhook-controlled: validate every part before it reaches a DB
  // query. itemId/roundId must be real uuids, the type must be known, and an
  // unexpected number of segments means a malformed/forged ref — reject all.
  if (
    parts.length > 4 ||
    !isModerationItemType(itemType) ||
    !itemId ||
    !UUID_RE.test(itemId) ||
    !roundId ||
    !UUID_RE.test(roundId)
  ) {
    throw new Error(`Unrecognized moderation content ref: ${ref}`);
  }
  return { itemType, itemId, roundId, mediaId };
};
