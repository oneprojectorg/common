export function enumToPgEnum<T extends Record<string, string | number>>(
  myEnum: T,
): [string, ...string[]] {
  return Object.values(myEnum).map((value: string | number) => `${value}`) as [
    string,
    ...string[],
  ];
}
