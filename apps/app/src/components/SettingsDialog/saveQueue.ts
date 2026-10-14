export const createSaveQueue = <T>({
  run,
  onIdle,
}: {
  run: (item: T) => Promise<unknown>;
  onIdle: () => void;
}) => {
  let tail: Promise<unknown> = Promise.resolve();
  let depth = 0;

  return (item: T): Promise<unknown> => {
    depth += 1;
    tail = tail
      .then(() => run(item))
      .catch(() => undefined)
      .finally(() => {
        depth -= 1;
        if (depth === 0) {
          onIdle();
        }
      });
    return tail;
  };
};
