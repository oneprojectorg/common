export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const getFieldPathDepth = (path: string): number =>
  path.split('.').length;

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
