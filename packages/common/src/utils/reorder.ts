// Single-item reorder by "upper neighbor": move the item keyed `movedKey` so
// it sits immediately after the item keyed `upperNeighborKey`. When the upper
// neighbor is null, the item goes to the top.
//
// Why upperNeighbor (one nullable field) instead of beforeId/afterId (two
// optional fields)? With two mutually-exclusive fields the call site can
// silently swap semantics, and a list with N positions has 2*(N-1)+2 valid
// (beforeId, afterId) pairs vs N upperNeighbor values — there's no expressive
// gain. Just as important, every concurrent writer reads the latest order
// under the same lock and re-interprets "place after Y" against that fresh
// state, so two users dragging at once converge to a state that respects both
// intents (last writer's intent wins relative to the post-first-writer order).
//
// Pure data math. Returns the same list reference unchanged when the move is
// a no-op (moved key missing, upper neighbor non-null and missing, moved key
// already sits immediately after the upper neighbor, or movedKey ===
// upperNeighborKey). Callers that need to error on missing keys must validate
// before calling.
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
  if (movedKey === upperNeighborKey) return list;
  const fromIdx = list.findIndex((r) => getKey(r) === movedKey);
  if (fromIdx === -1) return list;
  const moved = list[fromIdx]!;
  const without = list.filter((_, i) => i !== fromIdx);
  let toIdx: number;
  if (upperNeighborKey === null) {
    toIdx = 0;
  } else {
    const upperIdx = without.findIndex((r) => getKey(r) === upperNeighborKey);
    if (upperIdx === -1) return list;
    toIdx = upperIdx + 1;
  }
  if (toIdx === fromIdx) return list;
  return [...without.slice(0, toIdx), moved, ...without.slice(toIdx)];
};
