export const readOwnField = ({
  data,
  path,
}: {
  data: unknown;
  path: string;
}): unknown => {
  let current = data;
  for (const segment of path.split('.')) {
    if (
      (!isRecord(current) && !Array.isArray(current)) ||
      !Object.hasOwn(current, segment)
    ) {
      return undefined;
    }
    current = Reflect.get(current, segment);
  }
  return current;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
