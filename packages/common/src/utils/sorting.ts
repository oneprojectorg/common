// Move `movedKey` to sit immediately after `upperNeighborKey` (null = top), then
// return the `sort_order` writes that bring the table in line with the new
// position. Only rows whose index actually changed are emitted; an empty array
// means no-op (move into the same slot, missing keys, single-item list, etc.).
export type ComputeSortOrderUpdatesInput<T> = {
  rows: readonly T[];
  getId: (row: T) => string;
  getKey: (row: T) => string;
  getSortOrder: (row: T) => number;
  movedKey: string;
  upperNeighborKey: string | null;
};

export const computeSortOrderUpdates = <T>({
  rows,
  getId,
  getKey,
  getSortOrder,
  movedKey,
  upperNeighborKey,
}: ComputeSortOrderUpdatesInput<T>): Array<{
  id: string;
  sortOrder: number;
}> => {
  if (movedKey === upperNeighborKey) {
    return [];
  }
  const fromIndex = rows.findIndex((r) => getKey(r) === movedKey);
  if (fromIndex === -1) {
    return [];
  }
  const moved = rows[fromIndex]!;
  const without = rows.filter((_, i) => i !== fromIndex);
  let toIndex: number;
  if (upperNeighborKey === null) {
    toIndex = 0;
  } else {
    const upperIndex = without.findIndex((r) => getKey(r) === upperNeighborKey);
    if (upperIndex === -1) {
      return [];
    }
    toIndex = upperIndex + 1;
  }
  if (toIndex === fromIndex) {
    return [];
  }
  const reordered = [
    ...without.slice(0, toIndex),
    moved,
    ...without.slice(toIndex),
  ];
  const updates: Array<{ id: string; sortOrder: number }> = [];
  for (let i = 0; i < reordered.length; i++) {
    const row = reordered[i]!;
    if (getSortOrder(row) !== i) {
      updates.push({ id: getId(row), sortOrder: i });
    }
  }
  return updates;
};
