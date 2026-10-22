export const textOrNull = (value: string | null | undefined): string | null =>
  value?.trim() || null;
