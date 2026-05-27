// Move `movedKey` to sit immediately after `upperNeighborKey`. Null upper
// neighbor means top. Returns the same list reference on any no-op.
export type ReorderByUpperNeighborInput<T> = {
  list: readonly T[];
  getKey: (item: T) => string;
  movedKey: string;
  upperNeighborKey: string | null;
};

export const reorderByUpperNeighbor = <T>({
  list,
  getKey,
  movedKey,
  upperNeighborKey,
}: ReorderByUpperNeighborInput<T>): readonly T[] => {
  if (movedKey === upperNeighborKey) {
    return list;
  }
  const fromIndex = list.findIndex((r) => getKey(r) === movedKey);
  if (fromIndex === -1) {
    return list;
  }
  const moved = list[fromIndex]!;
  const without = list.filter((_, i) => i !== fromIndex);
  let toIndex: number;
  if (upperNeighborKey === null) {
    toIndex = 0;
  } else {
    const upperIndex = without.findIndex((r) => getKey(r) === upperNeighborKey);
    if (upperIndex === -1) {
      return list;
    }
    toIndex = upperIndex + 1;
  }
  if (toIndex === fromIndex) {
    return list;
  }
  return [...without.slice(0, toIndex), moved, ...without.slice(toIndex)];
};
