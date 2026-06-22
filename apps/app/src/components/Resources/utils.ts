// Display-friendly hostname: drop leading `www.` and (optionally) cap the
// length so it fits in a card subtitle / fallback title field.
export const hostnameForDisplay = (
  url: string | null,
  maxLength?: number,
): string => {
  if (!url) {
    return '';
  }
  try {
    const hostname = new URL(url).hostname.replace(/^www\./i, '');
    return maxLength === undefined ? hostname : hostname.slice(0, maxLength);
  } catch {
    return '';
  }
};

// Hosts whose links are a playable video — drive the Play icon on resource
// cards. Matched against the bare hostname (with `www.` stripped) and its
// subdomains, so `m.youtube.com` and `player.vimeo.com` both count.
const VIDEO_HOSTS = ['youtube.com', 'youtu.be', 'vimeo.com', 'loom.com'];

export const isVideoUrl = (url: string | null): boolean => {
  if (!url) {
    return false;
  }
  try {
    const host = new URL(url).hostname.replace(/^www\./i, '').toLowerCase();
    return VIDEO_HOSTS.some((v) => host === v || host.endsWith(`.${v}`));
  } catch {
    return false;
  }
};

export const getExtension = (fileName: string | null): string | null => {
  if (!fileName) {
    return null;
  }
  const dot = fileName.lastIndexOf('.');
  if (dot < 0 || dot === fileName.length - 1) {
    return null;
  }
  return fileName.slice(dot + 1).toUpperCase();
};

export const stripExtension = (name: string): string => {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(0, dot) : name;
};

export const truncateName = (name: string, max = 50): string =>
  name.length <= max ? name : `${name.slice(0, max - 1)}…`;

type ItemWithId = { id: string };

// Re-order `items` so that `id` lands immediately after `upperNeighborId`
// (or at the top when `upperNeighborId` is null). Returns the original array
// unchanged when the move is a no-op or either id can't be found.
export const moveItemAfter = <T extends ItemWithId>(
  items: T[],
  id: string,
  upperNeighborId: string | null,
): T[] => {
  if (id === upperNeighborId) {
    return items;
  }
  const fromIndex = items.findIndex((item) => item.id === id);
  if (fromIndex === -1) {
    return items;
  }
  const moved = items[fromIndex]!;
  const without = items.filter((_, index) => index !== fromIndex);
  if (upperNeighborId === null) {
    return [moved, ...without];
  }
  const upperIndex = without.findIndex((item) => item.id === upperNeighborId);
  if (upperIndex === -1) {
    return items;
  }
  return [
    ...without.slice(0, upperIndex + 1),
    moved,
    ...without.slice(upperIndex + 1),
  ];
};

// Identify the single item that changed positions between two snapshots of
// the same set, as produced by dnd-kit's arrayMove. Returns null if no
// single-item move can be deduced (e.g. arrays differ in length).
export const findMovedItem = <T extends ItemWithId>(
  previous: T[],
  next: T[],
): { id: string; newIndex: number } | null => {
  if (previous.length !== next.length) {
    return null;
  }
  for (let index = 0; index < next.length; index++) {
    const previousItem = previous[index];
    const nextItem = next[index];
    if (!previousItem || !nextItem || previousItem.id === nextItem.id) {
      continue;
    }
    // arrayMove(prev, oldIndex, newIndex) only displaces a single item; every
    // other item shifts by exactly one slot. If the item now sitting at
    // `index` was previously at `index + 1`, then the *original* `index` item
    // moved down (i.e. it's the one that displaced everything after it).
    const movedDown = previous[index + 1]?.id === nextItem.id;
    if (movedDown) {
      const movedId = previousItem.id;
      const newIndex = next.findIndex((item) => item.id === movedId);
      return newIndex === -1 ? null : { id: movedId, newIndex };
    }
    return { id: nextItem.id, newIndex: index };
  }
  return null;
};

// Mirror the profile-edit website field: bare domains like "example.com"
// normalize to "https://example.com". Returns null for empty input so callers
// can treat "no URL" and "invalid URL" the same way.
export const normalizeHttpUrl = (raw: string): string | null => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
};

// Pull a single URL out of a drag-and-drop payload. Browsers expose dragged
// links/text as `text/uri-list` (preferred) or `text/plain`; OS file drops
// carry no usable text, so this returns null and the caller falls back to
// `dataTransfer.files`.
export const extractDropUrl = (dataTransfer: DataTransfer): string | null => {
  const raw =
    dataTransfer.getData('text/uri-list') || dataTransfer.getData('text/plain');
  if (!raw) {
    return null;
  }
  // uri-list may contain comment lines starting with '#'; take the first URL.
  const firstLine = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0 && !line.startsWith('#'));
  const candidate = firstLine ?? '';
  // A dragged hyperlink arrives as a full http(s) URL (or at least a
  // domain-like token). Be stricter than the manual URL input here: don't turn
  // arbitrary dragged plain text like "meeting notes" into "https://meeting".
  const looksLikeUrl =
    /^https?:\/\//i.test(candidate) || /^[^\s]+\.[^\s.]{2,}/.test(candidate);
  if (!looksLikeUrl) {
    return null;
  }
  return normalizeHttpUrl(candidate);
};
